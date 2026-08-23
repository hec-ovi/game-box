import type { Rng } from '@gb/kit'
import type { Rect, World } from '@gb/world'
import { BANDS, MOUNTAIN_CELLS, type Cell, type Size, type StreetLine } from './bands.ts'

/** Which wall of the valley a road leaves through. */
type ExitSide = 'south' | 'north' | 'east' | 'west'

/**
 * A road out of the valley: it starts at one of the town's own street crossings,
 * runs through the ring of mountains on that crossing's centreline, and leaves
 * the map. It is the widest road there is, because everything leaving town goes
 * down it, and it leaves along an avenue wherever the town has one going that
 * way: the spine carries on out of the valley. The last cell of pavement stops a
 * cell short of the edge, so the roadway runs off the grid onto open ground
 * rather than ending in two kerbs.
 */
export interface ExitRoad {
  /** The town crossing it leaves from: always a node of the street grid. */
  readonly junction: Cell
  /** The last cell of roadway, on the edge of the map. */
  readonly edge: Cell
  /** Roadway, from the crossing out to the edge. */
  readonly roadway: Rect
  /** A pavement each side of it, kerbed against the roadway. */
  readonly pavements: readonly [Rect, Rect]
}

const SIDES: readonly ExitSide[] = ['south', 'north', 'east', 'west']

/** Which way is out. */
const OUTWARD: Record<ExitSide, Cell> = {
  south: { x: 0, y: 1 },
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
}

/** How far a pavement runs along a road out: the mountain ring, less the cell at the edge. */
const PAVEMENT_RUN = MOUNTAIN_CELLS - 1

/** One road out per requested exit, each through a different wall of the valley. */
export function planExits(
  count: number,
  columns: readonly StreetLine[],
  rows: readonly StreetLine[],
  size: Size,
  rng: Rng,
): readonly ExitRoad[] {
  return rng
    .shuffle(SIDES)
    .slice(0, count)
    .map((side) => planExit(side, columns, rows, size, rng))
}

/** Paints one road out: roadway first, so it wins the cell where it crosses the town's pavement ring. */
export function paintExit(world: World, exit: ExitRoad): void {
  world.paint(exit.roadway, 'street')
  for (const pavement of exit.pavements) world.paint(pavement, 'sidewalk')
}

function planExit(side: ExitSide, columns: readonly StreetLine[], rows: readonly StreetLine[], size: Size, rng: Rng): ExitRoad {
  const out = OUTWARD[side]
  const vertical = out.x === 0
  const bands = vertical ? rows : columns
  const across: Cell = vertical ? { x: 1, y: 0 } : { x: 0, y: 1 }
  const road = BANDS.exit

  // the outermost band on the side we leave through, and a seeded one the other
  // way: an avenue if the town has one running out that way, because the road
  // out of the valley is the town's spine carrying on
  const leaving = (out.x + out.y > 0 ? bands[bands.length - 1]! : bands[0]!).centre
  const others = vertical ? columns : rows
  const spines = others.filter((line) => line.kind === 'avenue')
  const centre = rng.pick(spines.length ? spines : others).centre

  const junction: Cell = vertical ? { x: centre, y: leaving } : { x: leaving, y: centre }
  const far = vertical ? size.height - 1 : size.width - 1
  const beyond = out.x + out.y > 0 ? far : 0
  const edge: Cell = vertical ? { x: centre, y: beyond } : { x: beyond, y: centre }

  // a pavement each side, its inner kerb one cell out from the last cell of roadway
  const kerb = (sign: 1 | -1): Rect =>
    run(
      shift(shift(edge, out, -1), across, sign * (road.halfRoadway + 1)),
      shift(shift(edge, out, -PAVEMENT_RUN), across, sign * (road.halfRoadway + road.pavement)),
      0,
    )

  return { junction, edge, roadway: run(junction, edge, road.halfRoadway), pavements: [kerb(1), kerb(-1)] }
}

function shift(from: Cell, direction: Cell, cells: number): Cell {
  return { x: from.x + direction.x * cells, y: from.y + direction.y * cells }
}

/** Every cell between two ends of one line, inclusive, widened `half` cells each side. */
function run(a: Cell, b: Cell, half: number): Rect {
  const vertical = a.x === b.x
  return {
    x: Math.min(a.x, b.x) - (vertical ? half : 0),
    y: Math.min(a.y, b.y) - (vertical ? 0 : half),
    w: Math.abs(a.x - b.x) + 1 + (vertical ? half * 2 : 0),
    h: Math.abs(a.y - b.y) + 1 + (vertical ? 0 : half * 2),
  }
}
