import { METRICS, cellCentre, type Plot, type World } from '@gb/world'
import * as THREE from 'three'
import { CityBatcher } from './batch/batcher.ts'
import type { CityBuilding } from './batch/building.ts'
import type { Dressing } from './dressing.ts'
import { GROUND_KINDS, groundMesh, mountainMesh } from './ground.ts'
import { markingMeshes } from './marking-mesh.ts'
import { planMarkings, type Marking } from './markings.ts'
import { RoadNetwork } from './roads.ts'

export interface CityBuild {
  readonly root: THREE.Group
  /** Every building, by plot id: where it stands, and whether it is in the city. */
  readonly buildings: ReadonlyMap<string, CityBuilding>
  /** Where each building's door is, in metres. */
  readonly doorsteps: ReadonlyMap<string, THREE.Vector3>
  /** Builds one more plot into the city that is already standing, without rebuilding it. */
  add(plot: Plot): CityBuilding
  /** Where the player starts: on the pavement, facing the first door in town. */
  readonly spawn: { x: number; z: number; heading: number }
  /** Every rectangle of paint on the streets, in metres. */
  readonly markings: readonly Marking[]
}

/**
 * Turns a city into something you can stand in. Ground is one merged mesh per
 * surface, buildings come from the dressing at the size the plot says, and
 * everything lands where the grid puts it, in metres.
 *
 * The buildings go into one batch per material rather than one object each, so
 * the city costs a draw per material instead of a draw per building, and every
 * building still culls, hides and raycasts on its own.
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

  const markings = planMarkings(new RoadNetwork(world).links())
  for (const mesh of markingMeshes(markings, dressing)) root.add(mesh)

  const batcher = new CityBatcher(root)
  const doorsteps = new Map<string, THREE.Vector3>()
  const cell = world.cellSize

  const put = (plot: Plot): CityBuilding | undefined => {
    const size = {
      width: plot.rect.w * cell,
      depth: plot.rect.h * cell,
      height: storeyHeight(plot.storeys),
    }
    const centre = cellCentre(plot.rect.x + plot.rect.w / 2 - 0.5, plot.rect.y + plot.rect.h / 2 - 0.5, cell)
    const doorstep = cellCentre(plot.entrance.cell.x, plot.entrance.cell.y, cell)
    doorsteps.set(plot.id, new THREE.Vector3(doorstep.x, 0, doorstep.z))
    return batcher.offer(plot.id, dressing.building(plot, size), new THREE.Matrix4().makeTranslation(centre.x, 0, centre.z))
  }

  for (const plot of world.plots()) put(plot)
  const buildings = batcher.seal()

  return { root, buildings, doorsteps, add: (plot) => put(plot)!, spawn: spawnAt(world, doorsteps), markings }
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
