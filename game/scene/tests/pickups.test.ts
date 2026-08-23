import type { Anchor, Furniture, FurnitureProp, Item } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildInterior, Greybox, itemOf, PropFootprint, type InteriorBuild } from '../src/index.ts'
import { bar } from './bar.ts'
import { town } from './town.ts'

/**
 * Where a thing you can pick up ends up. Every one of them used to be put down
 * at the same 0.9 m whatever it was standing on, which sank a glass into a bar
 * counter and floated a bottle over a stool, and 60 of 88 of them were not over
 * the piece they belonged to at all.
 */

/** Ten microns: what a float32 position buffer holds, not a tolerance. */
const EXACT = 5

/** The same ten microns, as a margin on a rectangle. */
const HAIR = 1e-5

/** Every triangle of one thing lying about, boxed, wherever its geometry went. */
function drawnBox(built: InteriorBuild, itemId: string): THREE.Box3 {
  const handle = built.pickups.get(itemId)!
  if (handle.children.length > 0) return new THREE.Box3().setFromObject(handle)

  const box = new THREE.Box3()
  const found = new THREE.Box3()
  const matrix = new THREE.Matrix4()
  for (const child of built.root.children) {
    const batch = child as THREE.BatchedMesh
    const items = batch.userData['items'] as string[] | undefined
    if (!batch.isBatchedMesh || !items) continue
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

describe('a thing left in a room', () => {
  it('stands on the drawn top of whatever it is left on, over every room in a town', async () => {
    const world = await town()
    let onFurniture = 0
    let onTheFloor = 0

    for (const interior of world.interiors()) {
      const built = buildInterior(world, interior, new Greybox())
      for (const placement of world.placements()) {
        if (placement.at !== 'anchor' || placement.interiorId !== interior.id) continue
        const anchor = interior.anchors.find((one) => one.id === placement.anchorId)!
        const handle = built.pickups.get(placement.itemId)!
        const where = `${interior.id} ${placement.itemId} on ${anchor.kind}`
        const base = baseOf(built, placement.itemId)

        if (!anchor.propId) {
          // nothing to stand on but the floor, and the floor is at zero
          expect(base, where).toBeCloseTo(0, EXACT)
          onTheFloor++
          continue
        }
        const piece = interior.furniture.find((one) => one.id === anchor.propId)!
        const host = built.props.get(piece.id)!
        const footprint = new PropFootprint(piece.id, piece.prop, host)
        // the whole of it is on the piece, corners included, not just its middle
        for (const corner of cornersOf(built, placement.itemId)) {
          expect(footprint.contains(corner.x, corner.z, HAIR), `${where} overhangs`).toBe(true)
        }
        // and the piece is drawn right under it, at the height it was put down at
        expect(under(host, handle.position.x, handle.position.z, base + 0.01), where).toBeCloseTo(base, EXACT)
        onFurniture++
      }
    }

    expect(onFurniture, 'no town item stands on furniture').toBeGreaterThan(0)
    expect(onTheFloor, 'no town item stands on the floor').toBeGreaterThan(0)
  })

  it('stands on the surface a body uses, not on the highest thing the piece is drawn with', () => {
    const built = seated(new Seating())

    // the chair's backrest is the top of it; the seat is what a glass goes on
    expect(new THREE.Box3().setFromObject(built.props.get('prop_0001')!).max.y).toBeCloseTo(Seating.BACK, EXACT)
    expect(baseOf(built, 'item_0001')).toBeCloseTo(Seating.SEAT, EXACT)
  })

  it('draws every thing in the room out of one batch, and takes one out when it is lifted', () => {
    const built = seated(new Seating(), 4)

    const batches = built.root.children.filter((child) => (child as THREE.BatchedMesh).isBatchedMesh)
    expect(batches.map((batch) => batch.name)).toEqual(['pickups:0'])
    const batch = batches[0] as THREE.BatchedMesh
    expect(batch.instanceCount).toBe(4)
    // one buffer for four copies of the same model, four places for it
    expect(new Set([0, 1, 2, 3].map((instance) => batch.getGeometryIdAt(instance))).size).toBe(1)

    built.pickups.get('item_0002')!.removeFromParent()
    const items = batch.userData['items'] as string[]
    expect(batch.getVisibleAt(items.indexOf('item_0002'))).toBe(false)
    expect(batch.getVisibleAt(items.indexOf('item_0001'))).toBe(true)
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

/** One room with that many chairs, somebody's place at each, and a glass left on it. */
function seated(dressing: Greybox, places = 1): InteriorBuild {
  const furniture: Furniture[] = []
  const anchors: Anchor[] = []
  for (let at = 0; at < places; at++) {
    const id = `prop_000${at + 1}`
    furniture.push({ id, prop: 'chair', roomId: 'room_1', pos: { x: 1.5 + at * 1.5, y: 4 }, rot: 0 })
    anchors.push({ id: `anchor_000${at + 1}`, kind: 'sit', roomId: 'room_1', pos: { x: 1.5 + at * 1.5, y: 4 }, rot: 0, propId: id })
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
