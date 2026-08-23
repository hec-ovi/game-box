import type { Rng } from '@gb/kit'
import type { Rect } from '@gb/world'
import { BAND, CENTRELINE, MOUNTAIN_CELLS, spanOf, type Cell, type Size } from './bands.ts'
import { planExits, type ExitRoad } from './exits.ts'
import { cutsFourWays } from './plots.ts'

/** What the plan needs to know from the brief. */
export interface PlanSpec {
  readonly blocksX: number
  readonly blocksY: number
  /** Nominal cells per block side. Left out, the seed picks it. */
  readonly blockCells?: number | undefined
  /** How many roads leave through the mountains. Left out, the seed picks it. */
  readonly exits?: number | undefined
}

/** A block left unbuilt: a paved square or a green one. */
export interface OpenBlock {
  readonly rect: Rect
  readonly kind: 'plaza' | 'park'
}

export interface StreetPlan {
  /** Inner rectangles left between the streets, where buildings go. */
  readonly blocks: readonly Rect[]
  /** Blocks kept clear: a plaza or a park, painted and never built on. */
  readonly open: readonly OpenBlock[]
  /** Cell coordinates of every street centreline crossing. */
  readonly crossings: readonly Cell[]
  /** The roads out through the mountains: the only ways in or out of the valley. */
  readonly exits: readonly ExitRoad[]
  /** Where each street band starts, across and down. */
  readonly columns: readonly number[]
  readonly rows: readonly number[]
  /** The whole grid including mountains. */
  readonly size: Size
}

/** Nominal block sides the seed chooses from. All of them cut four ways. */
const NOMINAL_BLOCKS: readonly number[] = [15, 17, 19, 20]
/** Cells a single block may run over or under the nominal. */
const JITTER = 2
/** The range a block side may take, whether the brief names it or the seed picks it. */
export const MIN_BLOCK = 6
export const MAX_BLOCK = 40
/** How often an inner street is left out, merging two blocks into a long one. */
const MERGE_CHANCE = 0.25
/** Roads out when the brief does not say: usually one, rarely four. */
const EXIT_COUNTS: ReadonlyArray<readonly [number, number]> = [
  [1, 5],
  [2, 3],
  [3, 2],
  [4, 1],
]

/**
 * The widest block the planner can produce for a nominal size, which is what
 * bounds the grid. The jitter applies to a size the brief named as well as to
 * one the seed picked, so both are measured with it.
 */
export function widestBlock(blockCells?: number | undefined): number {
  return nudged(Math.min(MAX_BLOCK, (blockCells ?? Math.max(...NOMINAL_BLOCKS)) + JITTER))
}

/**
 * The most blocks a side that fits inside a grid this wide: the smallest block
 * the planner will cut, laid end to end with a street between each pair. Ask
 * for wider blocks than that and the grid check refuses the brief instead.
 */
export function mostBlocks(gridCells: number): number {
  return Math.max(1, Math.floor((gridCells - MOUNTAIN_CELLS * 2 - BAND) / (BAND + widestBlock(MIN_BLOCK))))
}

/** The grid a spec needs at its widest, before a seed narrows it down. */
export function widestGrid(spec: PlanSpec): Size {
  const cells = widestBlock(spec.blockCells)
  return { width: spanOf(spec.blocksX, cells), height: spanOf(spec.blocksY, cells) }
}

/**
 * Plans one town: where the streets run, how big each block is, which blocks
 * are left open, and which ways out of the valley. Everything a seed decides
 * about the shape of the place is decided here, and nothing here touches the
 * world, so the same seed always plans the same town.
 */
export function planStreets(spec: PlanSpec, rng: Rng): StreetPlan {
  const nominal = spec.blockCells ?? rng.pick(NOMINAL_BLOCKS)
  // one axis at most loses streets, so a town gets long blocks without a hole in it
  const merging = rng.pick(['across', 'down', 'neither'] as const)
  const across = axis(spec.blocksX, nominal, merging === 'across', rng)
  const down = axis(spec.blocksY, nominal, merging === 'down', rng)

  const size = { width: across.span, height: down.span }
  const cells = across.runs.flatMap((column) =>
    down.runs.map((row) => ({ x: column.start, y: row.start, w: column.size, h: row.size })),
  )
  const kept = rng.shuffle(cells.map((_, index) => index)).slice(0, openCount(cells.length, rng))
  const open = kept.map((index) => ({ rect: cells[index]!, kind: rng.chance(0.5) ? ('park' as const) : ('plaza' as const) }))

  return {
    blocks: cells.filter((_, index) => !kept.includes(index)),
    open,
    crossings: across.streets.flatMap((x) => down.streets.map((y) => ({ x: x + CENTRELINE, y: y + CENTRELINE }))),
    exits: planExits(spec.exits ?? rng.weighted(EXIT_COUNTS), across.streets, down.streets, size, rng),
    columns: across.streets,
    rows: down.streets,
    size,
  }
}

/** Street bands and the strips of land between them, along one axis. */
interface Axis {
  /** Where each street band starts. */
  readonly streets: readonly number[]
  /** The land between two streets: one block, or several with the street between them left out. */
  readonly runs: ReadonlyArray<{ start: number; size: number }>
  /** Cells from one edge of the map to the other, mountains included. */
  readonly span: number
}

function axis(blocks: number, nominal: number, mayMerge: boolean, rng: Rng): Axis {
  const sizes = Array.from({ length: blocks }, () => blockSize(nominal, rng))
  const merges = Array.from({ length: Math.max(0, blocks - 1) }, () => mayMerge && rng.chance(MERGE_CHANCE))
  // never two in a row: three blocks in one leaves a field in the middle of town
  for (let i = 1; i < merges.length; i++) if (merges[i - 1]) merges[i] = false

  const streets: number[] = []
  const runs: Array<{ start: number; size: number }> = []
  let at = MOUNTAIN_CELLS
  for (let i = 0; i < blocks; i++) {
    streets.push(at)
    at += BAND
    const start = at
    at += sizes[i]!
    while (i < blocks - 1 && merges[i]) {
      at += BAND + sizes[i + 1]!
      i++
    }
    runs.push({ start, size: at - start })
  }
  streets.push(at)
  return { streets, runs, span: at + BAND + MOUNTAIN_CELLS }
}

/** One block's side: the nominal, jittered, nudged up if it would face only two ways. */
function blockSize(nominal: number, rng: Rng): number {
  return nudged(Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, nominal + rng.int(-JITTER, JITTER + 1))))
}

/** A block that would face only two ways is given the cell that puts doors on all four. */
function nudged(cells: number): number {
  return cutsFourWays(cells) || !cutsFourWays(cells + 1) ? cells : cells + 1
}

/** How many blocks are left open: about one in four at most, and never the only one. */
function openCount(blocks: number, rng: Rng): number {
  const most = Math.min(Math.floor(blocks / 4), blocks - 1)
  return most > 0 ? rng.int(0, most + 1) : 0
}
