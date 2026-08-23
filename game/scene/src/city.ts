import { METRICS, cellCentre, type Plot, type World } from '@gb/world'
import * as THREE from 'three'
import { CityBatcher } from './batch/batcher.ts'
import type { CityBuilding } from './batch/building.ts'
import { clutterMesh } from './clutter/mesh.ts'
import { CLUTTER_DENSITY, planClutter, type ClutterDensity, type ClutterPiece } from './clutter/plan.ts'
import type { Dressing } from './dressing.ts'
import { GROUND_KINDS, groundMesh, mountainMesh } from './ground.ts'
import { markingMeshes } from './marking-mesh.ts'
import { planMarkings, type Marking } from './markings.ts'
import { RoadNetwork } from './roads.ts'
import { spawnAt, type Standing } from './spawn.ts'
import { StreetSkin } from './street/skin.ts'

/** What a city may be built differently. Left out, it comes out of the world itself. */
export interface CityOptions {
  /** Where every random choice on the street comes from. Left out, the world's own seed. */
  readonly seed?: string
  /** 0 dry to 1 soaked, to start at. Whoever owns the weather moves it after that. */
  readonly wetness?: number
  /** 0 by day to 1 after dark, to start at. Left out, after dark. */
  readonly night?: number
  /** How much rubbish the streets carry, or `false` for a city that has been swept. */
  readonly clutter?: false | Partial<ClutterDensity>
}

export interface CityBuild {
  readonly root: THREE.Group
  /** Every building, by plot id: where it stands, and whether it is in the city. */
  readonly buildings: ReadonlyMap<string, CityBuilding>
  /** Where each building's door is, in metres. */
  readonly doorsteps: ReadonlyMap<string, THREE.Vector3>
  /** Builds one more plot into the city that is already standing, without rebuilding it. */
  add(plot: Plot): CityBuilding
  /** Where the player starts: on the pavement, facing the first door in town that opens. */
  readonly spawn: Standing
  /** Every rectangle of paint on the streets, in metres. */
  readonly markings: readonly Marking[]
  /** Everything lying on the streets, in metres. */
  readonly clutter: readonly ClutterPiece[]
  /** How wet the streets are, 0 to 1: read `@gb/land`'s `wetness` into this. */
  wetness: number
  /** How dark it is, 0 by day to 1 after dark: the same hour the buildings light up on. */
  night: number
}

/**
 * Turns a city into something you can stand in. Ground is one merged mesh per
 * surface, buildings come from the dressing at the size the plot says, and
 * everything lands where the grid puts it, in metres.
 *
 * The buildings go into one batch per material rather than one object each, so
 * the city costs a draw per material instead of a draw per building, and every
 * building still culls, hides and raycasts on its own. The street surface and
 * everything lying on it are one draw each on the same principle.
 */
export function buildCity(world: World, dressing: Dressing, options: CityOptions = {}): CityBuild {
  const root = new THREE.Group()
  root.name = world.id
  const seed = options.seed ?? world.seed

  for (const kind of GROUND_KINDS) {
    const mesh = groundMesh(world, kind, dressing)
    if (mesh) root.add(mesh)
  }
  const mountains = mountainMesh(world, dressing)
  if (mountains) root.add(mountains)

  const markings = planMarkings(new RoadNetwork(world).links())
  for (const mesh of markingMeshes(markings, dressing)) root.add(mesh)

  const skin = StreetSkin.over(world, seed)
  if (skin) {
    skin.wetness = options.wetness ?? 0
    skin.night = options.night ?? 1
    root.add(skin.mesh)
  }

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

  const clutter = litterOf(world, doorsteps, markings, seed, options.clutter)
  const rubbish = clutterMesh(clutter, seed, dressing)
  if (rubbish) root.add(rubbish)

  return {
    root,
    buildings,
    doorsteps,
    add: (plot) => put(plot)!,
    spawn: spawnAt(world, doorsteps),
    markings,
    clutter,
    get wetness(): number {
      return skin?.wetness ?? 0
    },
    set wetness(wetness: number) {
      if (skin) skin.wetness = wetness
    },
    get night(): number {
      return skin?.night ?? 0
    },
    set night(darkness: number) {
      if (skin) skin.night = darkness
    },
  }
}

/** The rubbish the streets carry, unless the city was asked for without any. */
function litterOf(
  world: World,
  doorsteps: ReadonlyMap<string, THREE.Vector3>,
  markings: readonly Marking[],
  seed: string,
  wanted: CityOptions['clutter'],
): ClutterPiece[] {
  if (wanted === false) return []
  return planClutter(world, doorsteps.values(), markings, seed, density(wanted))
}

function density(over: Partial<ClutterDensity> | undefined): ClutterDensity | undefined {
  if (!over) return undefined
  return { ...CLUTTER_DENSITY, ...over }
}

/** Ground floor is taller than the rest, the way a real street front is. */
export function storeyHeight(storeys: number): number {
  const { groundFloorHeight, storeyHeight: upper } = METRICS.building
  return groundFloorHeight + Math.max(0, storeys - 1) * upper
}
