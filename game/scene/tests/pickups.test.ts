import type { Anchor, Furniture, FurnitureProp, Interior, Item, World } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildInterior, Greybox, itemOf, PropFootprint, type InteriorBuild } from '../src/index.ts'
import { bar } from './bar.ts'
import { bigTown, town } from './town.ts'

/**
 * Where a thing you can pick up ends up, whether the room was built with it
 * there or the player put it down. Every one of them used to be put down at the same 0.9 m
 * whatever it was standing on, which sank a glass into a bar counter and
 * floated a bottle over a stool, and 60 of 88 of them were not over the piece
 * they belonged to at all. Then a thing put down after the room was built was
 * drawn back where it came from, because its place was baked into the batch the
 * one time it was added.
 */

/** Ten microns: what a float32 position buffer holds, not a tolerance. */
const EXACT = 5

/** The same ten microns, as a margin on a rectangle. */
const HAIR = 1e-5

/** Every room of two towns, so the rule is tested on the class and not on one room. */
function rooms(): Array<{ world: World; interior: Interior }> {
  const worlds = [town(), bigTown()]
  return worlds.flatMap((world) => [...world.interiors()].map((interior) => ({ world, interior })))
}

/** What was lying about in that room before it was built. */
function leftIn(world: World, interior: Interior): Array<{ itemId: string; anchorId: string }> {
  const found: Array<{ itemId: string; anchorId: string }> = []
  for (const placement of world.placements()) {
    if (placement.at !== 'anchor' || placement.interiorId !== interior.id) continue
    found.push({ itemId: placement.itemId, anchorId: placement.anchorId })
  }
  return found
}

/** The batches a room draws its things out of. */
function batchesOf(built: InteriorBuild): THREE.BatchedMesh[] {
  return built.root.children.filter((child) => (child as THREE.BatchedMesh).isBatchedMesh) as THREE.BatchedMesh[]
}

/** What the room costs: how much is in it, how many draws its things take, and how many copies are in the buffers. */
function cost(built: InteriorBuild): { objects: number; draws: number; instances: number } {
  const batches = batchesOf(built)
  return {
    objects: built.root.children.length,
    draws: batches.length,
    instances: batches.reduce((total, batch) => total + batch.instanceCount, 0),
  }
}

/** Every triangle of one thing lying about, boxed, wherever its geometry went. */
function drawnBox(built: InteriorBuild, itemId: string): THREE.Box3 {
  const handle = built.pickups.get(itemId)!
  if (handle.children.length > 0) return new THREE.Box3().setFromObject(handle)

  const box = new THREE.Box3()
  const found = new THREE.Box3()
  const matrix = new THREE.Matrix4()
  for (const batch of batchesOf(built)) {
    const items = batch.userData['items'] as string[] | undefined
    if (!items) continue
    for (let instance = 0; instance < items.length; instance++) {
      if (items[instance] !== itemId || !batch.getVisibleAt(instance)) continue
      batch.getBoundingBoxAt(batch.getGeometryIdAt(instance), found)
      box.union(found.applyMatrix4(batch.getMatrixAt(instance, matrix)))
    }
  }
  return box
}

/** The lowest triangle of it: what it is resting on. */
function baseOf(built: InteriorBuild, itemId: string): number {
  return drawnBox(built, itemId).min.y
}

/** The four corners of the floor one thing covers. */
function cornersOf(built: InteriorBuild, itemId: string): Array<{ x: number; z: number }> {
  const box = drawnBox(built, itemId)
  return [
    { x: box.min.x, z: box.min.z },
    { x: box.min.x, z: box.max.z },
    { x: box.max.x, z: box.min.z },
    { x: box.max.x, z: box.max.z },
  ]
}

/** What is drawn under that point of the floor, up to that height. */
function under(object: THREE.Object3D, x: number, z: number, from: number): number | undefined {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, from, z), new THREE.Vector3(0, -1, 0), 0, from)
  return ray.intersectObject(object, true)[0]?.point.y
}

/** The whole of that thing stands on the piece the anchor belongs to, at the height the piece is drawn to. */
function expectStandingOn(built: InteriorBuild, interior: Interior, itemId: string, propId: string, where: string): void {
  const piece = interior.furniture.find((one) => one.id === propId)!
  const host = built.props.get(piece.id)!
  const footprint = new PropFootprint(piece.id, piece.prop, host)
  const base = baseOf(built, itemId)
  const box = drawnBox(built, itemId)
  const size = box.getSize(new THREE.Vector3())

  if (size.x <= footprint.halfWidth * 2 + HAIR && size.z <= footprint.halfDepth * 2 + HAIR) {
    // the whole of it is on the piece, corners included, not just its middle
    for (const corner of cornersOf(built, itemId)) {
      expect(footprint.contains(corner.x, corner.z, HAIR), `${where} overhangs`).toBe(true)
    }
  } else {
    // a thing wider than the piece stands in the middle of it
    const middle = box.getCenter(new THREE.Vector3())
    expect(middle.x, `${where} off centre`).toBeCloseTo(footprint.x, EXACT)
    expect(middle.z, `${where} off centre`).toBeCloseTo(footprint.z, EXACT)
  }
  // and the piece is drawn right under it, at the height it was put down at
  const handle = built.pickups.get(itemId)!
  expect(under(host, handle.position.x, handle.position.z, base + 0.01), where).toBeCloseTo(base, EXACT)
}

/** The same box, to the ten microns a position buffer holds. */
function expectSamePlace(box: THREE.Box3, was: THREE.Box3, where: string): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(box.min[axis], `${where} ${axis}`).toBeCloseTo(was.min[axis], EXACT)
    expect(box.max[axis], `${where} ${axis}`).toBeCloseTo(was.max[axis], EXACT)
  }
}

describe('a thing left in a room', () => {
  it('stands on the drawn top of whatever it is left on, over every room in two towns', () => {
    let placed = 0

    for (const { world, interior } of rooms()) {
      const built = buildInterior(world, interior, new Greybox())
      for (const { itemId, anchorId } of leftIn(world, interior)) {
        const anchor = interior.anchors.find((one) => one.id === anchorId)!
        if (!anchor.propId) continue
        expectStandingOn(built, interior, itemId, anchor.propId, `${interior.id} ${itemId} on ${anchor.kind}`)
        placed++
      }
    }

    expect(placed, 'no town item stands on furniture').toBeGreaterThan(0)
  })

  it('lands the same way when the game puts it down as when the room was built with it there', () => {
    let anchoredOnFurniture = 0
    let anchoredOnTheFloor = 0

    for (const { world, interior } of rooms()) {
      const built = buildInterior(world, interior, new Greybox())
      const left = leftIn(world, interior)
      if (left.length === 0) continue
      const asBuilt = new Map(left.map(({ itemId }) => [itemId, drawnBox(built, itemId).clone()]))
      const before = cost(built)

      // the whole room is somewhere a thing can be put down, not only the
      // anchors the room was laid out with something on
      const carried = left[0]!.itemId
      for (const anchor of interior.anchors) {
        built.pickups.get(carried)!.removeFromParent()
        const handle = built.leave(carried, anchor.id)
        const where = `${interior.id} ${carried} left on ${anchor.kind}`
        expect(handle, where).toBeDefined()

        if (anchor.propId) {
          expectStandingOn(built, interior, carried, anchor.propId, where)
          anchoredOnFurniture++
        } else {
          // nothing to stand on but the floor, and the floor is at zero
          expect(baseOf(built, carried), where).toBeCloseTo(0, EXACT)
          anchoredOnTheFloor++
        }
      }

      // and back where it started is where it started: one rule, called twice
      for (const { itemId, anchorId } of left) {
        built.pickups.get(itemId)!.removeFromParent()
        built.leave(itemId, anchorId)
        expectSamePlace(drawnBox(built, itemId), asBuilt.get(itemId)!, `${interior.id} ${itemId} put back`)
      }

      // moving things about is not a room that quietly grows draws
      expect(cost(built), interior.id).toEqual(before)
    }

    expect(anchoredOnFurniture, 'no anchor in either town has furniture behind it').toBeGreaterThan(0)
    expect(anchoredOnTheFloor, 'no anchor in either town stands on bare floor').toBeGreaterThan(0)
  })

  it('stands on the surface a body uses, not on the highest thing the piece is drawn with', () => {
    const built = seated(new Seating())

    // the chair's backrest is the top of it; the seat is what a glass goes on
    expect(new THREE.Box3().setFromObject(built.props.get('prop_0001')!).max.y).toBeCloseTo(Seating.BACK, EXACT)
    expect(baseOf(built, 'item_0001')).toBeCloseTo(Seating.SEAT, EXACT)
  })

  it('draws every thing in the room out of one batch, and takes one out when it is lifted', () => {
    const built = seated(new Seating(), 4)

    const batches = batchesOf(built)
    expect(batches.map((batch) => batch.name)).toEqual(['pickups:0'])
    const batch = batches[0]!
    expect(batch.instanceCount).toBe(4)
    // one buffer for four copies of the same model, four places for it
    expect(new Set([0, 1, 2, 3].map((instance) => batch.getGeometryIdAt(instance))).size).toBe(1)

    built.pickups.get('item_0002')!.removeFromParent()
    const items = batch.userData['items'] as string[]
    expect(batch.getVisibleAt(items.indexOf('item_0002'))).toBe(false)
    expect(batch.getVisibleAt(items.indexOf('item_0001'))).toBe(true)
  })

  it('is taken and put down again as often as the player likes, and the buffer holds one copy of it', () => {
    const built = seated(new Seating(), 3)
    const batch = batchesOf(built)[0]!
    const instance = (batch.userData['items'] as string[]).indexOf('item_0001')
    const home = drawnBox(built, 'item_0001').clone()
    const before = cost(built)

    for (let round = 0; round < 3; round++) {
      built.pickups.get('item_0001')!.removeFromParent()
      expect(batch.getVisibleAt(instance), 'drawn while it is in the player\'s hands').toBe(false)

      // put down on the far chair: it is drawn there, not back where it was
      const moved = built.leave('item_0001', 'anchor_0003')!
      expect(moved).toBe(built.pickups.get('item_0001'))
      expect(batch.getVisibleAt(instance)).toBe(true)
      expect(baseOf(built, 'item_0001')).toBeCloseTo(Seating.SEAT, EXACT)
      expect(drawnBox(built, 'item_0001').min.distanceTo(home.min)).toBeGreaterThan(1)

      built.pickups.get('item_0001')!.removeFromParent()
      built.leave('item_0001', 'anchor_0001')
      expectSamePlace(drawnBox(built, 'item_0001'), home, `round ${round}`)
    }

    expect(cost(built)).toEqual(before)
  })

  it('moves a thing no batch would take the same way it moves the rest', () => {
    const built = seated(new LooseSeating(), 3)
    const handle = built.pickups.get('item_0001')!
    expect(batchesOf(built), 'a kit no batch will take has no batch').toEqual([])
    const home = drawnBox(built, 'item_0001').clone()
    expect(home.min.y).toBeCloseTo(Seating.SEAT, EXACT)

    handle.removeFromParent()
    expect(built.leave('item_0001', 'anchor_0003')).toBe(handle)
    expect(baseOf(built, 'item_0001')).toBeCloseTo(Seating.SEAT, EXACT)
    expect(drawnBox(built, 'item_0001').min.distanceTo(home.min)).toBeGreaterThan(1)
  })

  it('answers nothing, and draws nothing, for an anchor or a thing the room has not got', () => {
    const built = seated(new Seating())
    const before = cost(built)

    expect(built.leave('item_0001', 'anchor_0404')).toBeUndefined()
    expect(built.leave('item_0404', 'anchor_0001')).toBeUndefined()

    expect(cost(built)).toEqual(before)
  })

  it('says which item a ray landed on, though they are all in one batch', () => {
    const built = seated(new Seating(), 3)
    const raycaster = new THREE.Raycaster()

    for (const [itemId, handle] of built.pickups) {
      raycaster.set(new THREE.Vector3(handle.position.x, 3, handle.position.z), new THREE.Vector3(0, -1, 0))
      const hit = raycaster.intersectObject(built.root, true).find((one) => itemOf(one) !== undefined)!

      expect(hit, itemId).toBeDefined()
      expect(itemOf(hit)).toBe(itemId)
    }
  })
})

/**
 * A kit drawing a chair the way a real one is: a round seat a body sits on,
 * with a backrest standing over it. Neither the highest triangle nor the corner
 * of the footprint is the surface, which is what a plain box cannot show. Its
 * glasses come off one buffer on one material, the way a real kit's do.
 */
class Seating extends Greybox {
  static readonly SEAT = 0.45
  static readonly BACK = 0.9
  static readonly RADIUS = 0.22
  readonly #material = new THREE.MeshStandardMaterial()
  readonly #glass = new THREE.BoxGeometry(0.07, 0.14, 0.07).translate(0, 0.07, 0)

  override prop(prop: FurnitureProp): THREE.Object3D {
    if (prop !== 'chair') return super.prop(prop)

    const seat = new THREE.Mesh(new THREE.CylinderGeometry(Seating.RADIUS, Seating.RADIUS, 0.06, 16), this.#material)
    seat.position.y = Seating.SEAT - 0.03
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, Seating.BACK - Seating.SEAT, 0.05), this.#material)
    back.position.set(0, (Seating.BACK + Seating.SEAT) / 2, Seating.RADIUS)

    const base = new THREE.Group()
    base.add(seat)
    base.add(back)
    return base
  }

  override pickup(): THREE.Object3D {
    return new THREE.Mesh(this.#glass, this.#material)
  }
}

/** The same kit drawing its glasses as instanced meshes, which no batch will take: each one stands on its own in the room. */
class LooseSeating extends Seating {
  override pickup(): THREE.Object3D {
    const glass = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.14, 0.07).translate(0, 0.07, 0), new THREE.MeshStandardMaterial(), 1)
    glass.setMatrixAt(0, new THREE.Matrix4())

    const base = new THREE.Group()
    base.add(glass)
    return base
  }
}

/** One room with that many chairs, somebody's place at each, and a glass left on it. */
function seated(dressing: Greybox, places = 1): InteriorBuild {
  const furniture: Furniture[] = []
  const anchors: Anchor[] = []
  for (let at = 0; at < places; at++) {
    const id = `prop_000${at + 1}`
    furniture.push({ id, prop: 'chair', roomId: 'room_0001', pos: { x: 1.5 + at * 1.5, y: 4 }, rot: 0 })
    anchors.push({ id: `anchor_000${at + 1}`, kind: 'sit', roomId: 'room_0001', pos: { x: 1.5 + at * 1.5, y: 4 }, rot: 0, propId: id })
  }
  const { world, interior } = bar(furniture, anchors)

  for (let at = 0; at < places; at++) {
    const item: Item = {
      id: `item_000${at + 1}`,
      name: 'Glass',
      description: 'a glass',
      archetype: 'glass',
      value: 1,
      bulk: 'pocket',
    }
    const put = world.addItem(item, { at: 'anchor', itemId: item.id, interiorId: interior.id, anchorId: `anchor_000${at + 1}` })
    if (!put.ok) throw new Error(put.error.code)
  }
  return buildInterior(world, interior, dressing)
}
