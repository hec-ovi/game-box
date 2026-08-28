import { districtShape, type MapEdge } from '@gb/hud'
import { storeyHeight } from '@gb/scene'
import { METRICS, type CellKind, type Rect, type World } from '@gb/world'
import { patchesOf } from './cells.ts'

/** A rectangle of ground, in metres: its near corner and how far it runs. */
export interface Patch {
  readonly x: number
  readonly z: number
  readonly w: number
  readonly d: number
}

/** A building, as the blueprint draws it: its footprint on the ground, how tall it stands, and the part of town it is in. */
export interface Massing extends Patch {
  readonly height: number
  /** The zone it stands in, or empty for a building in none. */
  readonly zone: string
}

/** A straight line on the ground, in metres. */
export interface Line {
  readonly x1: number
  readonly z1: number
  readonly x2: number
  readonly z2: number
}

/** A part of the city: what it is called, the blocks it holds, the line round them, and where its label floats. */
export interface Zone {
  readonly id: string
  readonly name: string
  readonly pads: readonly Patch[]
  readonly border: readonly Line[]
  /** The middle of its largest block, where the label is written. */
  readonly heart: { readonly x: number; readonly z: number }
  /** How far above the ground the label floats: clear of the tallest thing in the zone. */
  readonly top: number
  readonly buildings: number
}

/**
 * A place marked on the plan: where fast travel boards. It carries no name,
 * because the sign over a door is written with the city and a plan is drawn
 * before any of that; what is marked is that trains board here.
 */
export interface Marker extends Patch {
  readonly id: string
  /** How far above the ground its label floats. */
  readonly top: number
}

/** Everything the blueprint draws, in metres, worked out once when it opens. */
export interface Plan {
  readonly ground: Patch
  readonly roadway: readonly Patch[]
  readonly pavement: readonly Patch[]
  readonly open: readonly Patch[]
  readonly water: readonly Patch[]
  readonly buildings: readonly Massing[]
  readonly zones: readonly Zone[]
  readonly stations: readonly Marker[]
  /** The tallest building in town, in storeys. */
  readonly tallest: number
}

/** How far above the tallest building in a zone its label floats. */
const NAME_LIFT = 30
/** How far above the ground a station's label floats. */
const MARK_LIFT = 26

/**
 * How far a part of town is carried out past its blocks, in cells: half the
 * widest road that can run between two of them, so its blocks meet in the
 * middle of their own streets and it comes out as one region rather than as a
 * heap of outlined blocks. Two parts of town either side of a narrower street
 * meet in it and overlap by a cell or two, which is a seam nobody can see at
 * the distance a whole city is read from.
 */
const HALF_STREET = Math.max(
  ...(['street', 'avenue'] as const).map((kind) => Math.ceil((METRICS.road[kind].roadwayCells + METRICS.road[kind].pavementCells * 2) / 2)),
)

/**
 * A laid out city as a blueprint: the streets, the buildings at the heights
 * they will stand at, the parts of town as the shapes they are under whatever
 * they are called, and the stations. Nothing else is in a plan, so nothing
 * else is here.
 *
 * Everything is in metres, worked out the way `@gb/scene` works it out, so a
 * tower in the blueprint is the tower the game builds.
 */
export function planOf(world: World): Plan {
  const cell = world.cellSize
  const ground = { x: 0, z: 0, w: world.grid.width * cell, d: world.grid.height * cell }
  const buildings = world
    .plots()
    .map((plot) => ({ ...patch(plot.rect, cell), height: storeyHeight(plot.storeys), zone: plot.district ?? '' }))

  return {
    ground,
    roadway: paved(world, 'street', cell),
    pavement: paved(world, 'sidewalk', cell),
    open: paved(world, 'park', cell),
    water: paved(world, 'water', cell),
    buildings,
    zones: zonesOf(world, cell),
    stations: world.stations().map((plot) => ({ id: plot.id, top: MARK_LIFT, ...patch(plot.rect, cell) })),
    tallest: world.plots().reduce((most, plot) => Math.max(most, plot.storeys), 0),
  }
}

/** The buildings of each part of town, and under the empty key the ones in none. */
export function byZone(buildings: readonly Massing[]): Map<string, Massing[]> {
  const grouped = new Map<string, Massing[]>()
  for (const building of buildings) {
    const standing = grouped.get(building.zone)
    if (standing) standing.push(building)
    else grouped.set(building.zone, [building])
  }
  return grouped
}

function paved(world: World, kind: CellKind, cell: number): Patch[] {
  return patchesOf(world.grid, kind).map((rect) => patch(rect, cell))
}

function zonesOf(world: World, cell: number): Zone[] {
  const tallest = new Map<string, number>()
  const counted = new Map<string, number>()
  for (const plot of world.plots()) {
    if (!plot.district) continue
    tallest.set(plot.district, Math.max(tallest.get(plot.district) ?? 0, storeyHeight(plot.storeys)))
    counted.set(plot.district, (counted.get(plot.district) ?? 0) + 1)
  }
  return world.districts().map((district) => {
    // the shape a part of town is comes from `@gb/hud`, so the plan in the
    // window and the drawing on the glass are one derivation
    const shape = districtShape({ id: district.id, name: district.name, rects: district.blocks }, HALF_STREET)
    return {
      id: district.id,
      name: district.name,
      pads: shape.rects.map((block) => patch(block, cell)),
      border: shape.border.map((edge) => line(edge, cell)),
      heart: { x: shape.heart.x * cell, z: shape.heart.y * cell },
      top: (tallest.get(district.id) ?? 0) + NAME_LIFT,
      buildings: counted.get(district.id) ?? 0,
    }
  })
}

function patch(rect: Rect, cell: number): Patch {
  return { x: rect.x * cell, z: rect.y * cell, w: rect.w * cell, d: rect.h * cell }
}

function line(edge: MapEdge, cell: number): Line {
  return { x1: edge.x1 * cell, z1: edge.y1 * cell, x2: edge.x2 * cell, z2: edge.y2 * cell }
}
