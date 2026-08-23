import { BUILDING_KINDS, CELL as CELL_CHARS, METRICS, type AnchorKind, type CellKind, type FurnitureProp, type Item, type Npc, type Plot } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { GROUND_LOOKS, GROUND_TEXTURES, KIT_MATERIALS, KitDressing, KitIncomplete, KitLibrary, KitUnmergeable, PIECES, PIECE_IDS, placeholderKit, RELIEF, loadKit, type KitPart, type PieceId } from '../src/index.ts'
import { boundsOf, CELL, fingerprint, meshesOf, plotOf, sizeOf, trianglesOf, wallBounds } from './support.ts'

const kit = placeholderKit()
const dressing = new KitDressing(kit)

/** A dressing that answers everything with a blank, for the tests that only care about one seam. */
const nothing = {
  building: () => new THREE.Object3D(),
  prop: (_p: FurnitureProp) => new THREE.Object3D(),
  character: (_n: Npc, _d: AnchorKind) => new THREE.Object3D(),
  pickup: (_i: Item) => new THREE.Object3D(),
  ground: (_k: CellKind) => new THREE.MeshBasicMaterial(),
  surface: (_p: 'floor' | 'wall' | 'ceiling') => new THREE.MeshBasicMaterial(),
}

/** The height @gb/scene gives a building of this many storeys. */
const heightOf = (storeys: number) => METRICS.building.groundFloorHeight + (storeys - 1) * METRICS.building.storeyHeight

describe('building', () => {
  it('fills the footprint it was given', () => {
    for (const rect of [{ x: 4, y: 4, w: 2, h: 2 }, { x: 10, y: 4, w: 5, h: 3 }, { x: 4, y: 12, w: 1, h: 4 }]) {
      const plot = plotOf({ kind: 'shop', rect, entrance: { cell: { x: rect.x, y: rect.y + rect.h }, facing: 'south' } })
      const size = sizeOf(plot, heightOf(plot.storeys))
      const bounds = wallBounds(dressing.building(plot, size))
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
      const bounds = wallBounds(dressing.building(plot, sizeOf(plot, heightOf(storeys))))

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
  it('indexes a kit by piece name, in the frame the pack put it in', () => {
    const library = loadKit(fakeKit())
    for (const id of PIECE_IDS) {
      const parts = library.parts(id)
      expect(parts.length, id).toBeGreaterThan(0)
      for (const part of parts) {
        part.geometry.computeBoundingBox()
        // the pack carries the piece's scale above the mesh, so it has to be baked in
        expect(part.geometry.boundingBox!.getSize(new THREE.Vector3()).x, id).toBeCloseTo(FAKE_SCALE, 6)
      }
    }
  })

  it('shares one material instance per name', () => {
    const library = loadKit(fakeKit())
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

describe('a library whose pieces do not agree', () => {
  it('says which material will not weld instead of building a mesh out of nothing', () => {
    const parts = new Map<PieceId, KitPart[]>(PIECE_IDS.map((id, at) => {
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      if (at % 2) geometry.deleteAttribute('uv') // the unevenness a raw kit export has
      return [id, [{ material: 'MI_RedBrick', geometry }]]
    }))
    const rogue = new KitLibrary(parts, new Map([['MI_RedBrick', new THREE.MeshStandardMaterial({ name: 'MI_RedBrick' })]]))
    const plot = plotOf({ kind: 'shop', rect: { x: 4, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' } })

    try {
      new KitDressing(rogue).building(plot, sizeOf(plot, heightOf(2)))
      expect.unreachable('a library that cannot weld has to say so')
    } catch (error) {
      expect(error).toBeInstanceOf(KitUnmergeable)
      expect((error as KitUnmergeable).code).toBe('kit-unmergeable')
      expect((error as KitUnmergeable).material).toBe('MI_RedBrick')
      expect((error as KitUnmergeable).pieces.length).toBeGreaterThan(1)
    }
  })
})

describe('everything that is neither a building nor the ground', () => {
  it('comes from the dressing behind it', () => {
    const named = (name: string) => Object.assign(new THREE.Object3D(), { name })
    const material = new THREE.MeshBasicMaterial()
    const layered = new KitDressing(kit, {
      ...nothing,
      prop: () => named('rest:prop'),
      character: () => named('rest:character'),
      pickup: () => named('rest:pickup'),
      surface: () => material,
    })

    expect(layered.prop('table').name).toBe('rest:prop')
    expect(layered.character({} as Npc, 'stand').name).toBe('rest:character')
    expect(layered.pickup({} as Item).name).toBe('rest:pickup')
    expect(layered.surface('floor')).toBe(material)
  })
})

describe('ground', () => {
  const dressed = new KitDressing(loadKit(fakeKit()))
  const kinds = Object.keys(CELL_CHARS) as CellKind[]

  it('gives every kind of cell a surface, and the same instance every time', () => {
    for (const kind of kinds) {
      const material = dressed.ground(kind)
      expect(material, kind).toBeInstanceOf(THREE.MeshStandardMaterial)
      // a city has thousands of cells and a handful of surfaces
      expect(dressed.ground(kind), kind).toBe(material)
    }
  })

  it('tiles at the size in metres it says it does', () => {
    for (const kind of kinds) {
      const look = GROUND_LOOKS[kind]
      const material = dressed.ground(kind) as THREE.MeshStandardMaterial

      for (const [slot, id] of [['map', look.map], ['normalMap', look.normal]] as const) {
        const texture = material[slot]
        if (!id) {
          expect(texture, `${kind} ${slot}`).toBeNull()
          continue
        }
        // @gb/scene lays ground UVs out in metres, so a tile of `tile` metres repeats 1 / tile
        expect(texture!.wrapS, `${kind} ${slot}`).toBe(THREE.RepeatWrapping)
        expect(texture!.wrapT, `${kind} ${slot}`).toBe(THREE.RepeatWrapping)
        expect(texture!.repeat.x, `${kind} ${slot}`).toBeCloseTo(1 / GROUND_TEXTURES[id].tile, 6)
        expect(texture!.repeat.y, `${kind} ${slot}`).toBeCloseTo(1 / GROUND_TEXTURES[id].tile, 6)
      }
    }
  })

  it('does not retune a texture the kit itself is painted with', () => {
    // the pack paints the road piece and the street with one image
    const shared = new THREE.Texture()
    const root = fakeKit()
    for (const node of [GROUND_TEXTURES.asphalt.node, PIECE_IDS[0]!]) {
      const mesh = meshesOf(root.getObjectByName(node)!)[0]!
      ;(mesh.material as THREE.MeshStandardMaterial).map = shared
    }

    const road = new KitDressing(loadKit(root)).ground('street') as THREE.MeshStandardMaterial

    expect(road.map).not.toBe(shared)
    expect(shared.repeat.x, 'the kit keeps the tiling it was authored with').toBe(1)
    expect(road.map!.repeat.x).toBeCloseTo(1 / GROUND_TEXTURES.asphalt.tile, 6)
  })

  it('falls back to what is behind it when the pack has no ground in it', () => {
    const plain = new THREE.MeshBasicMaterial()
    const behind = new KitDressing(placeholderKit(), { ...nothing, ground: () => plain })

    for (const kind of kinds) expect(behind.ground(kind), kind).toBe(plain)
    // and with nothing named behind it, the greybox answers
    expect(new KitDressing(placeholderKit()).ground('street')).toBeInstanceOf(THREE.Material)
  })
})

/** How much bigger the fake pack's node transform makes a piece than its mesh. */
const FAKE_SCALE = 2

/** A stand-in for the packed kit: one named node per piece and per ground surface. */
function fakeKit(): THREE.Object3D {
  const root = new THREE.Group()
  for (const surface of Object.values(GROUND_TEXTURES)) {
    const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() })
    if (surface.relief) material.normalMap = new THREE.Texture()
    const node = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    node.name = surface.node
    root.add(node)
  }
  for (const id of PIECE_IDS) {
    const node = new THREE.Group()
    node.name = id
    node.scale.setScalar(FAKE_SCALE) // the pack leaves a piece's dequantization on its node
    for (const name of PIECES[id].materials) {
      node.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name })))
    }
    root.add(node)
  }
  return root
}
