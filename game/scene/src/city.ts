import { METRICS, cellCentre, type World } from '@gb/world'
import * as THREE from 'three'
import type { Dressing } from './dressing.ts'
import { GROUND_KINDS, groundMesh, mountainMesh } from './ground.ts'

export interface CityBuild {
  readonly root: THREE.Group
  /** Every building, by plot id, so the game can find what the player is looking at. */
  readonly buildings: ReadonlyMap<string, THREE.Object3D>
  /** Where each building's door is, in metres. */
  readonly doorsteps: ReadonlyMap<string, THREE.Vector3>
  /** Where the player starts: on the pavement, facing the first door in town. */
  readonly spawn: { x: number; z: number; heading: number }
}

/**
 * Turns a city into something you can stand in. Ground is one merged mesh per
 * surface, buildings come from the dressing at the size the plot says, and
 * everything lands where the grid puts it, in metres.
 */
export function buildCity(world: World, dressing: Dressing): CityBuild {
  const root = new THREE.Group()
  root.name = world.id

  for (const kind of GROUND_KINDS) {
    const mesh = groundMesh(world, kind, dressing)
    if (mesh) root.add(mesh)
  }
  const mountains = mountainMesh(world, dressing)
  if (mountains) root.add(mountains)

  const buildings = new Map<string, THREE.Object3D>()
  const doorsteps = new Map<string, THREE.Vector3>()
  const cell = world.cellSize

  for (const plot of world.plots()) {
    const size = {
      width: plot.rect.w * cell,
      depth: plot.rect.h * cell,
      height: storeyHeight(plot.storeys),
    }
    const object = dressing.building(plot, size)
    const centre = cellCentre(plot.rect.x + plot.rect.w / 2 - 0.5, plot.rect.y + plot.rect.h / 2 - 0.5, cell)
    object.position.set(centre.x, 0, centre.z)
    root.add(object)
    buildings.set(plot.id, object)

    const doorstep = cellCentre(plot.entrance.cell.x, plot.entrance.cell.y, cell)
    doorsteps.set(plot.id, new THREE.Vector3(doorstep.x, 0, doorstep.z))
  }

  return { root, buildings, doorsteps, spawn: spawnAt(world, doorsteps) }
}

/** A step back from the first doorstep, looking at it. */
function spawnAt(world: World, doorsteps: ReadonlyMap<string, THREE.Vector3>): { x: number; z: number; heading: number } {
  const plot = world.plots().find((p) => p.interiorId) ?? world.plots()[0]
  const doorstep = plot ? doorsteps.get(plot.id) : undefined
  if (!plot || !doorstep) return { x: 0, z: 0, heading: 0 }

  const away = {
    north: { x: 0, z: -1 },
    south: { x: 0, z: 1 },
    west: { x: -1, z: 0 },
    east: { x: 1, z: 0 },
  }[plot.entrance.facing]

  // far enough back to see the front of the building, not its render
  const back = world.cellSize * 3
  return {
    x: doorstep.x + away.x * back,
    z: doorstep.z + away.z * back,
    // look back the way we stepped: three.js cameras look down -z at heading 0
    heading: Math.atan2(away.x, away.z),
  }
}

/** Ground floor is taller than the rest, the way a real street front is. */
export function storeyHeight(storeys: number): number {
  const { groundFloorHeight, storeyHeight: upper } = METRICS.building
  return groundFloorHeight + Math.max(0, storeys - 1) * upper
}
