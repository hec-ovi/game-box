import { METRICS, cellCentre, type Plot, type World } from '@gb/world'
import * as THREE from 'three'
import { CityBatcher } from './batch/batcher.ts'
import { CityBuilding } from './batch/building.ts'
import { clutterMesh } from './clutter/mesh.ts'
import { CLUTTER_DENSITY, planClutter, type ClutterDensity, type ClutterPiece } from './clutter/plan.ts'
import type { Dressing } from './dressing.ts'
import { GROUND_KINDS, groundMesh, mountainMesh } from './ground.ts'
import type { InteriorBuild } from './interior.ts'
import { CityLights, LIVE_LIGHTS } from './lights/city-lights.ts'
import { CityDetail, type Dressed } from './lod/detail.ts'
import { cellOf, DETAIL_RADIUS, sameCell, type Cell } from './lod/near.ts'
import { CityRooms } from './lod/rooms.ts'
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
  /** How many of the buildings' emitters may be real lights at once. Left out, `LIVE_LIGHTS`. */
  readonly lights?: number
  /** Metres from the player within which buildings are drawn in detail and rooms stay built. Left out, `DETAIL_RADIUS`. */
  readonly detail?: number
}

export interface CityBuild {
  readonly root: THREE.Group
  /** Every building, by plot id: where it stands, whether it is in the city, and whether it is drawn in detail. */
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
  /** What the buildings throw light from, and the few of them that are real lights at a time. */
  readonly lights: CityLights
  /**
   * Where the player is, in metres on the ground, every frame. The lights go
   * to the nearest emitters; when the cell changes, the buildings that came
   * near are drawn in detail, the ones that went far fall back to their
   * shells, and far rooms are let go of.
   */
  follow(x: number, z: number): void
  /** That interior, built on first entry and kept while the player is near. Nothing for an id the world lacks. */
  interior(interiorId: string): InteriorBuild | undefined
  /** The interiors standing built right now, by id. */
  readonly interiors: ReadonlySet<string>
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
 *
 * Every building is batched as its shell at open; the ones near the player
 * are dressed in detail on top, and that set moves with the player's cell.
 */
export function buildCity(world: World, dressing: Dressing, options: CityOptions = {}): CityBuild {
  const root = new THREE.Group()
  root.name = world.id
  const seed = options.seed ?? world.seed
  const radius = options.detail ?? DETAIL_RADIUS

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

  const shells = new CityBatcher(root, 'city')
  const lights = new CityLights(options.night ?? 1, options.lights ?? LIVE_LIGHTS)
  root.add(lights.group)
  const buildings = new Map<string, CityBuilding>()
  const doorsteps = new Map<string, THREE.Vector3>()
  const cell = world.cellSize
  // a dressing with no far look draws its whole building at every distance
  const splits = dressing.shell !== undefined

  const siteOf = (plot: Plot) => {
    const size = { width: plot.rect.w * cell, depth: plot.rect.h * cell, height: storeyHeight(plot.storeys) }
    // a plot's kind is the word of a charter the world holds: that is what makes it a plot
    const charter = world.charter(plot.kind)!
    const centre = cellCentre(plot.rect.x + plot.rect.w / 2 - 0.5, plot.rect.y + plot.rect.h / 2 - 0.5, cell)
    return { size, charter, at: new THREE.Matrix4().makeTranslation(centre.x, 0, centre.z) }
  }

  /** The shell of one plot into the city, and, for a dressing with no far look, its lights with it. */
  const shellOf = (plot: Plot) => {
    const { size, charter, at } = siteOf(plot)
    const doorstep = cellCentre(plot.entrance.cell.x, plot.entrance.cell.y, cell)
    doorsteps.set(plot.id, new THREE.Vector3(doorstep.x, 0, doorstep.z))
    const object = splits ? dressing.shell!(plot, size, charter) : dressing.building(plot, size, charter)
    const placing = shells.offer(plot.id, object, at)
    shells.settle()
    if (!splits) lights.add(plot.id, dressing.lights?.(plot, size, charter) ?? [], at)
    return placing
  }

  const dress = (plot: Plot): Dressed => {
    const { size, charter, at } = siteOf(plot)
    const object = dressing.building(plot, size, charter)
    return { object, emitters: dressing.lights?.(plot, size, charter) ?? [], at }
  }

  for (const plot of world.plots()) shellOf(plot)
  for (const [plotId, placing] of shells.seal()) buildings.set(plotId, new CityBuilding(plotId, placing))

  const spawn = spawnAt(world, doorsteps)
  let standing: Cell = cellOf(spawn.x, spawn.z, cell)
  // live round where the player opens their eyes, until the app says where the camera is
  lights.follow(spawn.x, spawn.z)

  const details = new CityBatcher(root, 'detail')
  const detail = splits ? new CityDetail(world, details, lights, buildings, dress, radius) : undefined
  if (detail) {
    for (const plot of world.plots()) if (detail.isNear(plot, standing)) detail.build(plot)
    detail.sealed(details.seal())
  }
  const rooms = new CityRooms(world, dressing, radius)

  const clutter = litterOf(world, doorsteps, markings, seed, options.clutter)
  const rubbish = clutterMesh(clutter, seed, dressing)
  if (rubbish) root.add(rubbish)

  return {
    root,
    buildings,
    doorsteps,
    add: (plot) => {
      const building = new CityBuilding(plot.id, shellOf(plot)!)
      buildings.set(plot.id, building)
      if (detail?.isNear(plot, standing)) detail.build(plot)
      return building
    },
    spawn,
    markings,
    clutter,
    lights,
    follow: (x, z) => {
      lights.follow(x, z)
      const now = cellOf(x, z, cell)
      if (sameCell(standing, now)) return
      standing = now
      detail?.follow(now)
      rooms.follow(now)
    },
    interior: (interiorId) => rooms.enter(interiorId),
    get interiors(): ReadonlySet<string> {
      return rooms.built
    },
    get wetness(): number {
      return skin?.wetness ?? 0
    },
    set wetness(wetness: number) {
      if (skin) skin.wetness = wetness
    },
    get night(): number {
      return lights.night
    },
    set night(darkness: number) {
      lights.night = darkness
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
