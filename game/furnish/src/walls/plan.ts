/**
 * Which bay goes where.
 *
 * A run of wall is cut at its doorways, and each stretch that is left is
 * divided into an even rhythm of bays: whole 10 cm room cells, all within a
 * cell of each other, so a wall reads as a rhythm rather than as a row of
 * different-sized boxes. Then each bay is dealt a kind from the taste of the
 * building's finish tilted by the room's use, filtered by what will actually
 * fit there.
 *
 * This is the distribution and nothing else. It draws from a stream forked per
 * room and per wall, so retuning the taste cannot move the furniture, and
 * adding a bay kind cannot change the wall next door. The one bay not dealt is
 * the booth: a room that dances stands exactly one, on the bay nearest its
 * dancers that has the wall clear for it.
 */
import { Rng } from '@gb/kit'
import { PROP_CELL, type Interior } from '@gb/world'
import { dancersIn, dancesIn, type Anchor } from '../dance/room.ts'
import type { RoomDress } from '../dress.ts'
import { BAY_SPECS, WALL, isFeature, type BayKind } from './bays.ts'
import { clears, openInFront, runsOf, segmentsOf, useOf, type Span, type TopOf, type WallRun } from './runs.ts'
import { tasteOf, type Taste } from './taste.ts'

/** How wide a bay wants to be, in cells. The rhythm settles near this. */
const PREFERRED_PROP_CELLS = 7

/** A stretch shorter than this is left as bare wall. */
const MIN_RUN_PROP_CELLS = 4

/** Metres of open floor a booth wants in front of it: the dancers, not the back of the bar. */
const BOOTH_FLOOR = 1.6

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
export function planInterior(interior: Interior, dress: RoomDress, seed: string, topOf: TopOf): PlannedRun[] {
  const root = new Rng(seed).fork('furnish').fork('walls').fork(dress.style).fork(interior.id)
  const planned: PlannedRun[] = []

  for (const room of interior.rooms) {
    const dancing = dancesIn(interior, room)
    const taste = tasteOf(dress.finish, useOf(room, dress.charter), dancing)
    const walls = runsOf(interior, room, topOf).map((run) => {
      const rng = root.fork(room.id).fork(run.side)
      return { run, bays: baysOf(run, taste, rng), bands: bandsOf(run) }
    })
    planned.push(...(dancing ? withBooth(walls, dancersIn(interior, room), room.rect) : walls))
  }
  return planned
}

/**
 * The booth on the wall nearest the dancers: the one bay of the room, wide
 * enough and with open floor in front of it, whose middle is closest to a
 * dancer, or to the middle of the room when nobody is dancing yet. A room with
 * no such bay has no booth.
 */
function withBooth(walls: PlannedRun[], dancers: readonly Anchor[], rect: { x: number; y: number; w: number; h: number }): PlannedRun[] {
  const spec = BAY_SPECS.booth
  const towards = dancers.length ? dancers.map((dancer) => dancer.pos) : [{ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }]
  let best: { wall: number; bay: number; distance: number } | undefined

  walls.forEach(({ run, bays }, wall) => {
    bays.forEach((bay, at) => {
      if (bay.cells < spec.cells[0] || bay.cells > spec.cells[1]) return
      if (!clears(run, bay, spec.depth, spec.low) || !openInFront(run, bay, BOOTH_FLOOR)) return
      const along = (bay.from + bay.to) / 2
      const here = run.side === 'north' || run.side === 'south' ? { x: along, y: run.face } : { x: run.face, y: along }
      const distance = Math.min(...towards.map((dancer) => Math.hypot(dancer.x - here.x, dancer.y - here.y)))
      if (!best || distance < best.distance) best = { wall, bay: at, distance }
    })
  })
  if (!best) return walls

  const chosen = best
  return walls.map((planned, wall) =>
    wall === chosen.wall
      ? { ...planned, bays: planned.bays.map((bay, at) => (at === chosen.bay ? { ...bay, kind: 'booth' as const } : bay)) }
      : planned,
  )
}

function baysOf(run: WallRun, taste: Taste, rng: Rng): PlannedBay[] {
  const bays: PlannedBay[] = []
  const segments = segmentsOf(run)

  for (let at = 0; at < segments.length; at++) {
    const stream = rng.fork(`run${at}`)
    let last: BayKind = 'plain'
    for (const [index, span] of dividedInto(segments[at]!).entries()) {
      const kind = kindFor(run, span.cells, spanOf(span), taste, last, stream.fork(`bay${index}`))
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
  return { from: span.cell * PROP_CELL, to: (span.cell + span.cells) * PROP_CELL }
}

/**
 * A stretch of wall as an even run of bays on the interior's own 10 cm lattice.
 *
 * The stretch is trimmed to whole cells, then divided into as near-equal bays
 * as whole cells allow: the remainder is handed out one cell at a time from the
 * start rather than left as a stub at the end.
 */
function dividedInto(span: Span): CellSpan[] {
  const first = Math.ceil(span.from / PROP_CELL - 1e-6)
  const cells = Math.floor(span.to / PROP_CELL + 1e-6) - first
  if (cells < MIN_RUN_PROP_CELLS) return []

  const widest = Math.max(...Object.values(BAY_SPECS).map((spec) => spec.cells[1]))
  let bays = Math.max(1, Math.round(cells / PREFERRED_PROP_CELLS))
  bays = Math.max(bays, Math.ceil(cells / widest))
  bays = Math.min(bays, Math.floor(cells / MIN_RUN_PROP_CELLS))

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

/** What this bay may be, and which of those the room reaches for. */
function kindFor(run: WallRun, cells: number, span: Span, taste: Taste, last: BayKind, rng: Rng): BayKind {
  const allowed = (Object.entries(taste) as [BayKind, number][]).filter(([kind, weight]) => {
    if (weight <= 0) return false
    if (kind === last && isFeature(kind)) return false
    const spec = BAY_SPECS[kind]
    if (cells < spec.cells[0] || cells > spec.cells[1]) return false
    if (spec.outsideOnly && !run.outside) return false
    return spec.behindFurniture || clears(run, span, spec.depth, spec.low)
  })
  return allowed.length ? rng.weighted(allowed) : 'plain'
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
    const first = Math.ceil(segment.from / PROP_CELL - 1e-6)
    const last = Math.floor(segment.to / PROP_CELL + 1e-6)
    for (let cell = first; cell < last; cell++) {
      const span = { from: cell * PROP_CELL, to: (cell + 1) * PROP_CELL }
      if (clears(run, span, WALL.rail.depth, WALL.rail.under)) open = open ? { from: open.from, to: span.to } : span
      else if (open) {
        bands.push(open)
        open = undefined
      }
    }
    if (open) bands.push(open)
  }
  return bands.filter((band) => band.to - band.from > 2 * PROP_CELL)
}
