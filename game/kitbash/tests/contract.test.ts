import { BUILDING_KINDS, METRICS, type AnchorKind, type CellKind, type FurnitureProp, type Item, type Npc, type Plot } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { KIT_MATERIALS, KitDressing, KitIncomplete, PIECES, PIECE_IDS, placeholderKit, RELIEF, loadKit } from '../src/index.ts'
import { boundsOf, CELL, fingerprint, meshesOf, plotOf, sizeOf, trianglesOf } from './support.ts'

const kit = placeholderKit()
const dressing = new KitDressing(kit)

/** The height @gb/scene gives a building of this many storeys. */
const heightOf = (storeys: number) => METRICS.building.groundFloorHeight + (storeys - 1) * METRICS.building.storeyHeight

describe('building', () => {
  it('fills the footprint it was given', () => {
    for (const rect of [{ x: 4, y: 4, w: 2, h: 2 }, { x: 10, y: 4, w: 5, h: 3 }, { x: 4, y: 12, w: 1, h: 4 }]) {
      const plot = plotOf({ kind: 'shop', rect, entrance: { cell: { x: rect.x, y: rect.y + rect.h }, facing: 'south' } })
      const size = sizeOf(plot, heightOf(plot.storeys))
      const bounds = boundsOf(dressing.building(plot, size))
      const measured = bounds.getSize(new THREE.Vector3())

      // the wall plane is the plot boundary; only window and trim relief stands past it
      expect(measured.x).toBeGreaterThanOrEqual(size.width - 1e-6)
      expect(measured.x).toBeLessThanOrEqual(size.width + 2 * RELIEF)
      expect(measured.z).toBeGreaterThanOrEqual(size.depth - 1e-6)
      expect(measured.z).toBeLessThanOrEqual(size.depth + 2 * RELIEF)

      // and it is centred on the plot, not shoved to one side of it
      const centre = bounds.getCenter(new THREE.Vector3())
      expect(Math.abs(centre.x)).toBeLessThanOrEqual(RELIEF)
      expect(Math.abs(centre.z)).toBeLessThanOrEqual(RELIEF)
    }
  })

  it('is as tall as its storeys and stands on the ground', () => {
    for (const storeys of [1, 2, 3, 6]) {
      const plot = plotOf({ kind: 'apartment', storeys, rect: { x: 4, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' } })
      const bounds = boundsOf(dressing.building(plot, sizeOf(plot, heightOf(storeys))))

      expect(bounds.max.y).toBeCloseTo(heightOf(storeys), 3)
      expect(bounds.min.y).toBeCloseTo(0, 1)
    }
  })

  it('puts the door on the face the entrance faces, next to the doorstep', () => {
    const rect = { x: 6, y: 6, w: 4, h: 3 }
    const outside: Record<string, { x: number; y: number }> = {
      north: { x: rect.x + 2, y: rect.y - 1 },
      south: { x: rect.x + 1, y: rect.y + rect.h },
      east: { x: rect.x + rect.w, y: rect.y + 2 },
      west: { x: rect.x - 1, y: rect.y + 1 },
    }
    for (const [facing, cell] of Object.entries(outside)) {
      const plot = plotOf({ kind: 'cafe', rect, entrance: { cell, facing: facing as Plot['entrance']['facing'] } })
      const size = sizeOf(plot, heightOf(plot.storeys))
      const door = dressing.building(plot, size).getObjectByName('door')!

      // the doorstep @gb/scene puts on the pavement, in the building's own frame
      const step = new THREE.Vector3(
        (cell.x + 0.5 - rect.x - rect.w / 2) * CELL,
        0,
        (cell.y + 0.5 - rect.y - rect.h / 2) * CELL,
      )
      const outward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), door.rotation.y)
      const toStep = step.clone().sub(door.position)

      // the door looks at the doorstep, and stands within a module of it
      expect(outward.dot(toStep.clone().normalize())).toBeGreaterThan(0.7)
      expect(toStep.length()).toBeLessThan(CELL * 1.5)
    }
  })

  it('builds the same building from the same plot every time', () => {
    const plot = plotOf({ kind: 'hotel', storeys: 4, rect: { x: 4, y: 4, w: 4, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' } })
    const size = sizeOf(plot, heightOf(4))
    expect(fingerprint(dressing.building(plot, size))).toBe(fingerprint(dressing.building(plot, size)))
  })

  it('gives every kind of place a building', () => {
    for (const kind of BUILDING_KINDS) {
      const plot = plotOf({ kind, storeys: 3, rect: { x: 4, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' } })
      const building = dressing.building(plot, sizeOf(plot, heightOf(3)))
      expect(trianglesOf(building), kind).toBeGreaterThan(0)
    }
  })

  it('costs one draw per material, not one per piece', () => {
    const plot = plotOf({ kind: 'office', storeys: 6, rect: { x: 4, y: 4, w: 5, h: 4 }, entrance: { cell: { x: 5, y: 8 }, facing: 'south' } })
    const meshes = meshesOf(dressing.building(plot, sizeOf(plot, heightOf(6))))
    const names = meshes.map((mesh) => (mesh.material as THREE.Material).name)

    expect(new Set(names).size).toBe(meshes.length)
    expect(meshes.length).toBeLessThanOrEqual(KIT_MATERIALS.length)
  })
})

describe('loadKit', () => {
  it('indexes a kit by piece name and shares one material per name', () => {
    const library = loadKit(fakeKit())
    for (const id of PIECE_IDS) expect(library.parts(id).length, id).toBeGreaterThan(0)
    expect(library.material('MI_RedBrick')).toBe(library.material('MI_RedBrick'))
  })

  it('refuses a kit that is missing pieces', () => {
    const partial = fakeKit()
    partial.remove(partial.getObjectByName('Brick_Plain_3')!)
    expect(() => loadKit(partial)).toThrowError(KitIncomplete)
    try {
      loadKit(partial)
    } catch (error) {
      expect((error as KitIncomplete).code).toBe('kit-incomplete')
      expect((error as KitIncomplete).missing).toEqual(['Brick_Plain_3'])
    }
  })
})

describe('everything that is not a building', () => {
  it('comes from the dressing behind it', () => {
    const named = (name: string) => Object.assign(new THREE.Object3D(), { name })
    const material = new THREE.MeshBasicMaterial()
    const rest = {
      building: () => named('rest:building'),
      prop: (_p: FurnitureProp) => named('rest:prop'),
      character: (_n: Npc, _d: AnchorKind) => named('rest:character'),
      pickup: (_i: Item) => named('rest:pickup'),
      ground: (_k: CellKind) => material,
      surface: (_p: 'floor' | 'wall' | 'ceiling') => material,
    }
    const layered = new KitDressing(kit, rest)

    expect(layered.prop('table').name).toBe('rest:prop')
    expect(layered.character({} as Npc, 'stand').name).toBe('rest:character')
    expect(layered.pickup({} as Item).name).toBe('rest:pickup')
    expect(layered.ground('street')).toBe(material)
    expect(layered.surface('floor')).toBe(material)
    // with nothing behind it, the greybox answers
    expect(new KitDressing(kit).ground('street')).toBeInstanceOf(THREE.Material)
  })
})

/** A stand-in for the packed kit: one named node per piece, one mesh per material on it. */
function fakeKit(): THREE.Object3D {
  const root = new THREE.Group()
  for (const id of PIECE_IDS) {
    const node = new THREE.Group()
    node.name = id
    node.position.set(3, 0, 0) // pieces are indexed in their own frame, not the pack's
    for (const name of PIECES[id].materials) {
      node.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name })))
    }
    root.add(node)
  }
  return root
}
