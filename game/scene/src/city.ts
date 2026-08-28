import { METRICS, cellCentre, type Plot, type ResolvedCharter, type World } from '@gb/world'
import * as THREE from 'three'
import { CityBatcher } from './batch/batcher.ts'
import { CityBuilding } from './batch/building.ts'
import { clutterMesh } from './clutter/mesh.ts'
import { CLUTTER_DENSITY, planClutter, type ClutterDensity, type ClutterPiece } from './clutter/plan.ts'
import type { BuildingSize, Dressing } from './dressing.ts'
import { GROUND_KINDS, groundMesh, mountainMesh } from './ground.ts'
import type { InteriorBuild } from './interior.ts'
import { CityLights, LIVE_LIGHTS } from './lights/city-lights.ts'
import { StreamBudget, WHOLE } from './lod/budget.ts'
import { CityMassing, type Site } from './lod/massing.ts'
import { cellOf, DETAIL_RADIUS, sameCell, SHELL_RADIUS, type Cell } from './lod/near.ts'
import { CityRing, type Dressed } from './lod/ring.ts'
import { CityRooms } from './lod/rooms.ts'
import { markingMeshes } from './marking-mesh.ts'
import { planMarkings, type Marking } from './markings.ts'
import { RoadNetwork } from './roads.ts'
import { emittersOf, offerTo } from './seam.ts'
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
  /** Metres from the player within which buildings wear the shell their dressing drew. Left out, `SHELL_RADIUS`. */
  readonly shell?: number
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
   * to the nearest emitters, fading over `seconds` if the frame's elapsed time
   * is given and arriving at once if it is not; when the cell changes, the
   * buildings that came near are queued to be drawn in detail, the ones that
   * came within the shell radius are queued for their shells, the ones that
   * went beyond fall back to their massing, and far rooms are let go of.
   *
   * The queue is worked through over the frames and never on one: a frame
   * spends `STREAM_BUDGET`, or `STANDING_BUDGET` where the player has not
   * moved, and hands what it went over by to the frames after it. `settle`
   * is how a caller asks for the lot.
   */
  follow(x: number, z: number, seconds?: number): void
  /**
   * Everything `follow` has queued and not built yet, built now, however long
   * it takes, and the lights cut again over what it built: what a city opening
   * behind a loader wants, and what a ride between stations wants behind its
   * veil. A frame in a running game never calls it.
   */
  settle(): void
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
 * A building is drawn one of three ways and the player's cell picks which: its
 * massing across town, its dressing's shell down the street, its whole detail
 * on the pavement. Only the skyline is held for the whole town; the shells and
 * the detail stream in rings round the player, so a city of any size costs the
 * player's own neighbourhood plus twelve triangles a plot.
 */
export function buildCity(world: World, dressing: Dressing, options: CityOptions = {}): CityBuild {
  const root = new THREE.Group()
  root.name = world.id
  const seed = options.seed ?? world.seed
  const near = options.detail ?? DETAIL_RADIUS
  // the shell never reaches less far than the detail: a building would have to
  // drop from its whole self to its silhouette in one step
  const far = Math.max(near, options.shell ?? SHELL_RADIUS)

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

  const lights = new CityLights(options.night ?? 1, options.lights ?? LIVE_LIGHTS)
  root.add(lights.group)
  const buildings = new Map<string, CityBuilding>()
  const doorsteps = new Map<string, THREE.Vector3>()
  const cell = world.cellSize
  // a dressing with no far look draws its whole building wherever it is drawn
  const splits = dressing.shell !== undefined

  /** Where one plot's building stands, how big it is, and what the world says it is. */
  const placeOf = (plot: Plot) => {
    // a plot's kind is the word of a charter the world holds: that is what makes it a plot
    const charter = world.charter(plot.kind)!
    const centre = cellCentre(plot.rect.x + plot.rect.w / 2 - 0.5, plot.rect.y + plot.rect.h / 2 - 0.5, cell)
    const size = { width: plot.rect.w * cell, depth: plot.rect.h * cell, height: storeyHeight(plot.storeys) }
    const site: Site = { x: centre.x, z: centre.z, size, tint: charter.tint }
    return { charter, size, site, at: new THREE.Matrix4().makeTranslation(centre.x, 0, centre.z) }
  }

  /** One way of drawing a plot, and whether the ring that draws it that way carries its light. */
  const look =
    (build: (plot: Plot, size: BuildingSize, charter: ResolvedCharter) => THREE.Object3D | undefined, lit: boolean) =>
    (plot: Plot): Dressed => {
      const { size, charter, at } = placeOf(plot)
      return { object: build(plot, size, charter), emitters: lit ? emittersOf(dressing.lights?.(plot, size, charter)) : [], at }
    }

  const asBuilding = (plot: Plot, size: BuildingSize, charter: ResolvedCharter) => dressing.building(plot, size, charter)
  const asShell = (plot: Plot, size: BuildingSize, charter: ResolvedCharter) => dressing.shell!(plot, size, charter)

  /** Where a plot's door is, on the pavement in front of it. */
  const doorstepOf = (plot: Plot) => {
    const at = cellCentre(plot.entrance.cell.x, plot.entrance.cell.y, cell)
    return new THREE.Vector3(at.x, 0, at.z)
  }

  // every plot stands in the skyline whatever its dressing draws, so nothing is
  // left without a place in the city to be hidden, shown or dressed from
  const plots = world.plots()
  const sites = plots.map((plot) => placeOf(plot).site)
  const massing = new CityMassing(root, dressing, plots.length, sites.map((site) => site.tint))
  for (const [at, plot] of plots.entries()) {
    doorsteps.set(plot.id, doorstepOf(plot))
    buildings.set(plot.id, new CityBuilding(plot.id, massing.place(plot.id, sites[at]!)))
  }
  massing.settle()

  const spawn = spawnAt(world, doorsteps)
  let standing: Cell = cellOf(spawn.x, spawn.z, cell)
  /** Where the player was last seen, so settling can cut the lights over what it just built. */
  let where = { x: spawn.x, z: spawn.z }
  // live round where the player opens their eyes, until the app says where the camera is
  lights.follow(spawn.x, spawn.z)

  const shells = new CityBatcher(root, 'city', true)
  const shelled = new CityRing({
    world,
    batcher: shells,
    buildings,
    step: 'shell',
    // a shell that answers nothing for a plot leaves its whole building as the
    // far look, so the plot never jumps from its massing straight to its detail
    looks: splits ? [look(asShell, false), look(asBuilding, false)] : [look(asBuilding, true)],
    radius: far,
    // with no near ring to hang them on, the far ring carries the lights
    ...(splits ? {} : { lights }),
  })
  shelled.open(standing)
  shelled.sealed(shells.seal())

  const details = new CityBatcher(root, 'detail', true)
  const detailed = splits
    ? new CityRing({ world, batcher: details, buildings, step: 'detail', looks: [look(asBuilding, true)], radius: near, lights })
    : undefined
  if (detailed) {
    detailed.open(standing)
    detailed.sealed(details.seal())
  }
  const rooms = new CityRooms(world, dressing, near)
  const budget = new StreamBudget()

  const clutter = litterOf(world, doorsteps, markings, seed, options.clutter)
  const rubbish = clutterMesh(clutter, seed, dressing)
  if (rubbish) root.add(rubbish)

  return {
    root,
    buildings,
    doorsteps,
    add: (plot) => {
      doorsteps.set(plot.id, doorstepOf(plot))
      const building = new CityBuilding(plot.id, massing.place(plot.id, placeOf(plot).site))
      massing.settle()
      buildings.set(plot.id, building)
      if (shelled.isNear(plot, standing)) shelled.hold(plot)
      if (detailed?.isNear(plot, standing)) detailed.hold(plot)
      return building
    },
    spawn,
    markings,
    clutter,
    lights,
    follow: (x, z, seconds) => {
      lights.follow(x, z, seconds)
      const now = cellOf(x, z, cell)
      if (!sameCell(standing, now)) {
        standing = now
        shelled.follow(now)
        detailed?.follow(now)
        rooms.follow(now)
      }
      where = { x, z }
      // the near ring goes first: a building the player can read beats one
      // four blocks off
      budget.open(x, z)
      detailed?.catchUp(budget)
      shelled.catchUp(budget)
    },
    settle: () => {
      detailed?.catchUp(WHOLE)
      shelled.catchUp(WHOLE)
      // a building hangs its emitters as it is built, so the budget is cut
      // again over the ones that were not there when the frame opened
      lights.follow(where.x, where.z)
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
