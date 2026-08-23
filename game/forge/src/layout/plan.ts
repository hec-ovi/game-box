import type { Rng } from '@gb/kit'
import type { Rect } from '@gb/world'
import { BANDS, lineAt, MOUNTAIN_CELLS, spanOf, type Cell, type Size, type StreetLine } from './bands.ts'
import { chooseAvenues } from './avenues.ts'
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

/** Where two street centrelines cross, and what class of road runs each way through it. */
export interface Junction {
  readonly cell: Cell
  /** The band running north to south through it. */
  readonly column: StreetLine
  /** The band running east to west through it. */
  readonly row: StreetLine
}

export interface StreetPlan {
  /** Inner rectangles left between the streets, where buildings go. */
  readonly blocks: readonly Rect[]
  /** Blocks kept clear: a plaza or a park, painted and never built on. */
  readonly open: readonly OpenBlock[]
  /** Every street centreline crossing, with the class of road on each arm. */
  readonly crossings: readonly Junction[]
  /** The roads out through the mountains: the only ways in or out of the valley. */
  readonly exits: readonly ExitRoad[]
  /** Every street band, across and down: where it starts, what class it is, how wide. */
  readonly columns: readonly StreetLine[]
  readonly rows: readonly StreetLine[]
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
  const cells = widestBlock(MIN_BLOCK)
  let blocks = 1
  while (spanOf(blocks + 1, cells) <= gridCells) blocks++
  return blocks
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
  // the spines come off a stream of their own, so where they run is settled
  // without moving a block size or a merge
  const spines = rng.fork('avenues')
  const across = axis(spec.blocksX, nominal, merging === 'across', rng, spines.fork('across'))
  const down = axis(spec.blocksY, nominal, merging === 'down', rng, spines.fork('down'))

  const size = { width: across.span, height: down.span }
  const cells = across.runs.flatMap((column) =>
    down.runs.map((row) => ({ x: column.start, y: row.start, w: column.size, h: row.size })),
  )
  const kept = rng.shuffle(cells.map((_, index) => index)).slice(0, openCount(cells.length, rng))
  const open = kept.map((index) => ({ rect: cells[index]!, kind: rng.chance(0.5) ? ('park' as const) : ('plaza' as const) }))

  return {
    blocks: cells.filter((_, index) => !kept.includes(index)),
    open,
    crossings: across.streets.flatMap((column) =>
      down.streets.map((row) => ({ cell: { x: column.centre, y: row.centre }, column, row })),
    ),
    exits: planExits(spec.exits ?? rng.weighted(EXIT_COUNTS), across.streets, down.streets, size, rng),
    columns: across.streets,
    rows: down.streets,
    size,
  }
}

/** Street bands and the strips of land between them, along one axis. */
interface Axis {
  /** Every street band, in order across the map. */
  readonly streets: readonly StreetLine[]
  /** The land between two streets: one block, or several with the street between them left out. */
  readonly runs: ReadonlyArray<{ start: number; size: number }>
  /** Cells from one edge of the map to the other, mountains included. */
  readonly span: number
}

function axis(blocks: number, nominal: number, mayMerge: boolean, rng: Rng, spines: Rng): Axis {
  const sizes = Array.from({ length: blocks }, () => blockSize(nominal, rng))
  const merges = Array.from({ length: Math.max(0, blocks - 1) }, () => mayMerge && rng.chance(MERGE_CHANCE))
  // never two in a row: three blocks in one leaves a field in the middle of town
  for (let i = 1; i < merges.length; i++) if (merges[i - 1]) merges[i] = false

  // a street left out is not a line at all, so the spines are picked from what survives
  const lines = blocks + 1 - merges.filter(Boolean).length
  const avenues = chooseAvenues(lines, spines)

  const streets: StreetLine[] = []
  const runs: Array<{ start: number; size: number }> = []
  const band = (start: number): number => {
    const line = lineAt(start, avenues.has(streets.length) ? 'avenue' : 'street')
    streets.push(line)
    return line.width
  }

  let at = MOUNTAIN_CELLS
  for (let i = 0; i < blocks; i++) {
    at += band(at)
    const start = at
    at += sizes[i]!
    // the street that is left out is given to the block, so the town keeps its span
    while (i < blocks - 1 && merges[i]) {
      at += BANDS.street.width + sizes[i + 1]!
      i++
    }
    runs.push({ start, size: at - start })
  }
  const last = band(at)
  return { streets, runs, span: at + last + MOUNTAIN_CELLS }
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
