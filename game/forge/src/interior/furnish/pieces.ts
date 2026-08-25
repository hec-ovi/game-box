import type { AnchorKind, FurnitureProp } from '@gb/world'
import { alongWall, boxAt, faceReach, headingTo, inward, onWall, outward, step, wallBand, wallOf, type Side } from '../geometry.ts'
import { specOf } from '../props.ts'
import type { Placed, RoomPlan } from '../room-plan.ts'
import { seatRoot, standoff } from '../stance.ts'

/** Floor kept behind a counter for whoever works there. */
const STAFF_STRIP = 1.2

/** How far a seat is pushed in to the edge of the table it is drawn up to. */
const DRAWN_UP = 0.1

/** The floor a dancing body takes, so no table lands on their feet. */
const DANCER = { w: 0.9, d: 0.9 }

export interface ServeOptions {
  /** The run itself. A bar walks behind a bar counter; everywhere else serves over a counter. */
  readonly prop?: Extract<FurnitureProp, 'bar-counter' | 'counter'>
  /** Seats on the customer side, if the counter has any. */
  readonly stool?: Extract<FurnitureProp, 'bar-stool' | 'chair'>
  /** What stands on the counter top: a till, a coffee machine. */
  readonly onTop?: Extract<FurnitureProp, 'register' | 'coffee-machine'>
}

/** A counter run with the wall's choice of prop settled. */
interface Run extends ServeOptions {
  readonly prop: NonNullable<ServeOptions['prop']>
}

/**
 * A counter set out from a wall with a working strip behind it, the person who
 * works there facing the room, and seats drawn up on the customer side. The run
 * always stops short of one corner so the strip is a place you can walk into.
 */
function counterRun(plan: RoomPlan, side: Side, options: Run): Placed[] {
  const spec = specOf(options.prop)
  const wall = wallOf(plan.bounds, side)
  const span = wall.to - wall.from
  const depth = depthFrom(plan, side)
  // a shallow room cannot spare a strip behind the counter, so it goes flat against the wall
  const strip = depth >= STAFF_STRIP + spec.d + 1.1 ? STAFF_STRIP : 0
  const length = Math.min(span - 1.6, 4.5)
  if (length < spec.w || depth < spec.d + 1.2) return []

  const count = Math.max(1, Math.floor(length / spec.w))
  const run = count * spec.w
  const from = plan.rng.chance(0.5) ? wall.from + 0.3 : wall.to - 0.3 - run
  const segments: Placed[] = []
  for (let i = 0; i < count; i++) {
    const centre = onWall(wall, from + spec.w * (i + 0.5), strip + spec.d / 2)
    const placed = plan.at(options.prop, centre, inward(side))
    if (placed) segments.push(placed)
  }
  if (!segments.length) return []

  if (strip > 0) plan.reserve(wallBand(wall, from - 0.1, from + run + 0.1, strip))
  // up against the counter: behind it facing the room, or in front of it at a counter flat to the wall
  const staffed = segments[Math.floor(segments.length / 2)]!
  if (options.onTop) plan.onTop(staffed, options.onTop)
  const reach = standoff('serve')
  const post = onWall(wall, alongWall(wall, staffed.pos), strip > 0 ? strip - reach : spec.d + reach)
  plan.anchor('serve', post, strip > 0 ? inward(side) : outward(side), staffed.id)

  if (options.stool && strip > 0) {
    const seat = specOf(options.stool)
    const spacing = seat.w + 0.65
    const seats = Math.max(1, Math.floor(run / spacing))
    const start = from + (run - (seats - 1) * spacing) / 2
    // a seat like any other: the drinker's root lands the drawn-up gap off the
    // counter's face, and the stool goes its own seat offset behind that
    const out = seatRoot(options.stool, 'sit-drink') + DRAWN_UP / 4
    for (let i = 0; i < seats; i++) {
      const at = start + i * spacing
      const pos = onWall(wall, at, strip + spec.d + out)
      plan.seat(options.stool, pos, onWall(wall, at, strip), 'sit-drink')
    }
  }
  return segments
}

/** A counter somebody serves from, on the first wall that will take one, and that wall. */
export function servePost(plan: RoomPlan, options: ServeOptions = {}): Side | undefined {
  const run: Run = { prop: 'counter', ...options }
  for (const side of [plan.backSide(), ...plan.openSides()]) {
    if (counterRun(plan, side, run).length) return side
  }
  return undefined
}

/** How far the room runs back from one of its walls. */
function depthFrom(plan: RoomPlan, side: Side): number {
  return side === 'north' || side === 'south' ? plan.bounds.h : plan.bounds.w
}

/** Chairs drawn up to a table, each one against its edge and facing it. */
export function seatTable(plan: RoomPlan, table: Placed, seats: number, kind: AnchorKind): number {
  const top = specOf(table.prop)
  const seat = specOf('chair')
  let sat = 0
  for (const rot of plan.rng.shuffle([0, 90, 180, 270]).slice(0, seats)) {
    const away = faceReach(top, table.rot, rot) + seat.d / 2 + DRAWN_UP
    if (plan.seat('chair', step(table.pos, rot, away), table.pos, kind)) sat++
  }
  return sat
}

/**
 * An office chair drawn up to a desk, and the person sat in it with their hands
 * on the top. The chair goes where the seated root lands inside the desk's reach
 * band: the desk's own half depth, the stance, then the seat's own offset back
 * to the chair's centre.
 */
export function deskChair(plan: RoomPlan, desk: Placed, facing: number): boolean {
  const away = specOf(desk.prop).d / 2 + standoff('work-desk') + seatRoot('office-chair', 'work-desk')
  return plan.seat('office-chair', step(desk.pos, facing, away), desk.pos, 'work-desk')
}

/** As many of one piece along a wall as the wall will take. */
export function wallRow(plan: RoomPlan, prop: FurnitureProp, side: Side, count: number, approach = 0.6): Placed[] {
  const placed: Placed[] = []
  for (let i = 0; i < count; i++) {
    const piece = plan.againstWall(prop, side, { prefer: 'any', approach })
    if (piece) placed.push(piece)
  }
  return placed
}

/**
 * How often a room the public stands in has a screen on the wall. Not every
 * one: a set in every room reads as a rule rather than as a place, and a room
 * without one is what makes the lit ones register.
 */
const SCREEN = 0.6

/**
 * A screen on the wall of a room people wait in. It goes up before the floor
 * fills, so it takes the middle of a wall somebody sitting down can see, and it
 * claims a quarter of a metre of floor and nothing else.
 */
export function wallScreen(plan: RoomPlan): Placed | undefined {
  if (!plan.rng.chance(SCREEN)) return undefined
  for (const side of plan.openSides()) {
    const screen = plan.againstWall('tv', side, { prefer: 'centre', approach: 0.5 })
    if (screen) return screen
  }
  return undefined
}

/** Something small in a corner: a plant, a lamp, whatever the room wants. */
export function cornerPiece(plan: RoomPlan, prop: FurnitureProp): Placed | undefined {
  for (const side of plan.openSides().reverse()) {
    const piece = plan.againstWall(prop, side, { prefer: 'ends', approach: 0.3, margin: 0.05 })
    if (piece) return piece
  }
  return undefined
}

/**
 * People propped against the walls, watching the room: one per wall, on the
 * walls with no door, longest first. One or two is what reads as a room with
 * somebody in it rather than a room of empty chairs; a third against the same
 * wall reads as a queue.
 */
export function leanSpots(plan: RoomPlan, most: number): number {
  let placed = 0
  for (const side of plan.openSides()) {
    if (placed >= most) break
    if (plan.leanOn(side)) placed++
  }
  return placed
}

/**
 * Bodies dancing on the open floor, in the middle of the room where the tables
 * would go, each facing a different way. Only a room whose town calls for
 * dancing gets one, and it goes in before the tables so the floor is there.
 */
export function danceFloor(plan: RoomPlan, most: number): number {
  let placed = 0
  for (const spot of plan.rng.shuffle(plan.lattice(plan.bounds, { x: 1.2, y: 1.2 }))) {
    if (placed >= most) break
    const rot = plan.rng.pick([0, 90, 180, 270])
    if (!plan.anchor('dance', spot, rot)) continue
    // nothing stands under a dancer, so the floor they need is kept for them
    plan.reserve(boxAt(spot, DANCER, rot))
    placed++
  }
  return placed
}

export interface TableFieldOptions {
  readonly seats: number
  readonly kind: AnchorKind
  readonly spacing?: number
  readonly max?: number
  /** Tables in rows read as a dining room; scattered ones read as a bar. */
  readonly scattered?: boolean
}

/** Tables out on the floor, each with chairs drawn up to it. */
export function tableField(plan: RoomPlan, options: TableFieldOptions): number {
  const spacing = options.spacing ?? 2.5
  const spots = plan.lattice(plan.bounds, { x: spacing, y: spacing })
  const order = options.scattered ? plan.rng.shuffle(spots) : spots
  let placed = 0
  for (const spot of order) {
    if (placed >= (options.max ?? 6)) break
    const table = plan.at('table', spot, 0, 0, 0.35)
    if (!table) continue
    placed++
    seatTable(plan, table, options.seats, options.kind)
  }
  return placed
}

/** Where a person stands to use a piece: in front of it, facing it, as close as the work needs. */
export function standAt(plan: RoomPlan, piece: Placed, kind: AnchorKind): boolean {
  const front = step(piece.pos, piece.rot, specOf(piece.prop).d / 2 + standoff(kind))
  return plan.post(kind, front, piece.pos, piece.id)
}
