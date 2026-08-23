/**
 * Which bay goes where.
 *
 * A run of wall is cut at its doorways, and each stretch that is left is
 * divided into an even rhythm of bays: whole 10 cm room cells, all within a
 * cell of each other, so a wall reads as a rhythm rather than as a row of
 * different-sized boxes. Then each bay is dealt a kind from the language's
 * taste, filtered by what will actually fit there.
 *
 * This is the distribution and nothing else. It draws from a stream forked per
 * room and per wall, so retuning the taste cannot move the furniture, and
 * adding a bay kind cannot change the wall next door.
 */
import { Rng } from '@gb/kit'
import type { Interior } from '@gb/world'
import { CELL } from '../catalog/cells.ts'
import type { FurnishStyle } from '../style/palette.ts'
import { BAY_SPECS, BAY_TASTE, WALL, isFeature, type BayKind } from './bays.ts'
import { clears, runsOf, segmentsOf, type Span, type TopOf, type WallRun } from './runs.ts'

/** How wide a bay wants to be, in cells. The rhythm settles near this. */
const PREFERRED_CELLS = 7

/** A stretch shorter than this is left as bare wall. */
const MIN_RUN_CELLS = 4

export interface PlannedBay extends Span {
  readonly kind: BayKind
  /** How many 10 cm cells it claims. */
  readonly cells: number
  /** Stable label for the stream that decides what stands in it. */
  readonly label: string
}

export interface PlannedRun {
  readonly run: WallRun
  readonly bays: readonly PlannedBay[]
  /** Where the rail and its lit channel run, over the field of bays. */
  readonly bands: readonly Span[]
}

/** Every wall of every room in one interior, divided into bays. */
export function planInterior(
  interior: Interior,
  style: FurnishStyle,
  seed: string,
  topOf: TopOf,
): PlannedRun[] {
  const root = new Rng(seed).fork('furnish').fork('walls').fork(style).fork(interior.id)
  const planned: PlannedRun[] = []

  for (const room of interior.rooms) {
    for (const run of runsOf(interior, room, topOf)) {
      const rng = root.fork(room.id).fork(run.side)
      planned.push({ run, bays: baysOf(run, style, rng), bands: bandsOf(run) })
    }
  }
  return planned
}

function baysOf(run: WallRun, style: FurnishStyle, rng: Rng): PlannedBay[] {
  const bays: PlannedBay[] = []
  const segments = segmentsOf(run)

  for (let at = 0; at < segments.length; at++) {
    const stream = rng.fork(`run${at}`)
    let last: BayKind = 'plain'
    for (const [index, span] of dividedInto(segments[at]!).entries()) {
      const kind = kindFor(run, span.cells, spanOf(span), style, last, stream.fork(`bay${index}`))
      last = kind
      bays.push({ ...spanOf(span), kind, cells: span.cells, label: `${run.roomId}/${run.side}/${at}/${index}` })
    }
  }
  return bays
}

interface CellSpan {
  /** First cell of the interior lattice this bay claims. */
  readonly cell: number
  readonly cells: number
}

function spanOf(span: CellSpan): Span {
  return { from: span.cell * CELL, to: (span.cell + span.cells) * CELL }
}

/**
 * A stretch of wall as an even run of bays on the interior's own 10 cm lattice.
 *
 * The stretch is trimmed to whole cells, then divided into as near-equal bays
 * as whole cells allow: the remainder is handed out one cell at a time from the
 * start rather than left as a stub at the end.
 */
function dividedInto(span: Span): CellSpan[] {
  const first = Math.ceil(span.from / CELL - 1e-6)
  const cells = Math.floor(span.to / CELL + 1e-6) - first
  if (cells < MIN_RUN_CELLS) return []

  const widest = Math.max(...Object.values(BAY_SPECS).map((spec) => spec.cells[1]))
  let bays = Math.max(1, Math.round(cells / PREFERRED_CELLS))
  bays = Math.max(bays, Math.ceil(cells / widest))
  bays = Math.min(bays, Math.floor(cells / MIN_RUN_CELLS))

  const base = Math.floor(cells / bays)
  const extra = cells % bays
  const divided: CellSpan[] = []
  let at = first
  for (let index = 0; index < bays; index++) {
    const width = base + (index < extra ? 1 : 0)
    divided.push({ cell: at, cells: width })
    at += width
  }
  return divided
}

/** What this bay may be, and which of those the language reaches for. */
function kindFor(
  run: WallRun,
  cells: number,
  span: Span,
  style: FurnishStyle,
  last: BayKind,
  rng: Rng,
): BayKind {
  const allowed = BAY_TASTE[style].filter(([kind]) => {
    if (kind === last && isFeature(kind)) return false
    const spec = BAY_SPECS[kind]
    if (cells < spec.cells[0] || cells > spec.cells[1]) return false
    if (spec.outsideOnly && !run.outside) return false
    return spec.behindFurniture || clears(run, span, spec.depth, spec.low)
  })
  return allowed.length ? rng.weighted(allowed as [BayKind, number][]) : 'plain'
}

/**
 * Where the rail over the field can run: every stretch of the wall with nothing
 * standing in front of it that high. It is the room's own light, so it wants to
 * be as long a line as the wall allows.
 */
function bandsOf(run: WallRun): Span[] {
  const bands: Span[] = []
  for (const segment of segmentsOf(run)) {
    let open: Span | undefined
    const first = Math.ceil(segment.from / CELL - 1e-6)
    const last = Math.floor(segment.to / CELL + 1e-6)
    for (let cell = first; cell < last; cell++) {
      const span = { from: cell * CELL, to: (cell + 1) * CELL }
      if (clears(run, span, WALL.rail.depth, WALL.rail.under)) open = open ? { from: open.from, to: span.to } : span
      else if (open) {
        bands.push(open)
        open = undefined
      }
    }
    if (open) bands.push(open)
  }
  return bands.filter((band) => band.to - band.from > 2 * CELL)
}
