import { cellCentre, METRICS, World } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { KitDressing, KitLibrary, lampSpots, LAMP_SPACING, PIECES, PIECE_IDS, placeholderKit, type KitPart, type PieceId } from '../src/index.ts'

/** A block of buildings with a pavement round it and a road round that. */
function town(): World {
  const world = World.create({ name: 'street', theme: 'test', seed: 'street', width: 40, height: 40 })
  world.paint({ x: 2, y: 2, w: 36, h: 36 }, 'street')
  world.paint({ x: 4, y: 4, w: 32, h: 32 }, 'sidewalk')
  world.paint({ x: 5, y: 5, w: 30, h: 30 }, 'building')
  return world
}

const lamps = (world: World, dressing: KitDressing): THREE.Mesh[] => {
  const found: THREE.Mesh[] = []
  dressing.streetlights(world).traverse((child) => { if (child instanceof THREE.Mesh) found.push(child) })
  return found
}

describe('street lamps', () => {
  const world = town()
  const dressing = new KitDressing(placeholderKit())

  it('draws every lamp in the city twice, whatever the town is', () => {
    const drawn = lamps(world, dressing)
    const spots = lampSpots(world)

    expect(spots.length).toBeGreaterThan(8)
    // one instanced draw for the posts, one buffer for the haloes
    expect(drawn).toHaveLength(2)
    expect((drawn[0] as THREE.InstancedMesh).count).toBe(spots.length)
    expect((drawn[1]!.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(spots.length)
  })

  it('stands them on the pavement at the kerb, one run of street at a time', () => {
    const cell = world.cellSize
    for (const spot of lampSpots(world)) {
      const [x, y] = [Math.floor(spot.x / cell), Math.floor(spot.z / cell)]
      expect(world.grid.at(x, y), `${x},${y}`).toBe('sidewalk')

      // pulled off the middle of the cell, toward the road it lights
      const centre = cellCentre(x, y, cell)
      expect(Math.hypot(spot.x - centre.x, spot.z - centre.z)).toBeCloseTo(cell / 2 - 0.55, 6)
    }
  })

  it('lights every kerb, and no denser than it was asked for', () => {
    const perimeter = 4 * 32 * METRICS.cellSize // the pavement ring of the town above
    const spots = lampSpots(world)

    expect(spots.length).toBeLessThanOrEqual(Math.ceil(perimeter / LAMP_SPACING) + 4)
    // widening the spacing thins them out rather than moving them somewhere else
    expect(lampSpots(world, LAMP_SPACING * 3).length).toBeLessThan(spots.length)
  })

  it('puts the same lamps in the same places every run', () => {
    const read = (mesh: THREE.InstancedMesh): number[] => [...mesh.instanceMatrix.array].map((v) => Math.round(v * 1e6))
    const first = lamps(world, dressing)[0] as THREE.InstancedMesh
    const again = lamps(world, new KitDressing(placeholderKit()))[0] as THREE.InstancedMesh

    expect(read(again)).toEqual(read(first))
  })

  it('draws none at all from a kit with no lamp in it', () => {
    const parts = new Map<PieceId, KitPart[]>(PIECE_IDS.map((id) => [id, [{
      material: PIECES[id].materials[0]!,
      geometry: new THREE.BoxGeometry(1, 1, 1),
    }]]))
    const materials = new Map([...new Set(PIECE_IDS.map((id) => PIECES[id].materials[0]!))]
      .map((name) => [name, new THREE.MeshStandardMaterial({ name })] as const))
    const bare = new KitDressing(new KitLibrary(parts, materials))

    expect(lamps(world, bare)).toHaveLength(0)
  })
})
