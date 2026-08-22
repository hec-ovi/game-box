import type { AnchorKind, FurnitureProp } from '@gb/world'
import { alongWall, clamp, dirOf, inward, onWall, outward, round, step, wallBand, wallOf, type Side, type Vec } from '../geometry.ts'
import { specOf } from '../props.ts'
import type { Placed, RoomPlan } from '../room-plan.ts'

/** Floor kept behind a counter for whoever works there. */
const STAFF_STRIP = 1.2

export interface CounterOptions {
  readonly prop: Extract<FurnitureProp, 'bar-counter' | 'counter'>
  readonly serve: AnchorKind
  /** Seats on the customer side, if the counter has any. */
  readonly stool?: Extract<FurnitureProp, 'bar-stool' | 'chair'>
  readonly seatKind?: AnchorKind
  /** Something small on the end of the run: a till, a machine. */
  readonly extra?: FurnitureProp
}

/**
 * A counter set out from a wall with a working strip behind it, the person who
 * works there facing the room, and seats drawn up on the customer side. The run
 * always stops short of one corner so the strip is a place you can walk into.
 */
export function counterRun(plan: RoomPlan, side: Side, options: CounterOptions): Placed[] {
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
  // behind the counter facing the room, or in front of it at a counter flat to the wall
  const staffed = segments[Math.floor(segments.length / 2)]!
  const post = onWall(wall, alongWall(wall, staffed.pos), strip > 0 ? strip / 2 : spec.d + 0.55)
  plan.anchor(options.serve, post, strip > 0 ? inward(side) : outward(side), staffed.id)

  if (options.extra) {
    const extra = specOf(options.extra)
    const lowEnd = from - wall.from > wall.to - (from + run)
    const along = lowEnd ? from - 0.05 - extra.w / 2 : from + run + 0.05 + extra.w / 2
    plan.at(options.extra, onWall(wall, along, strip + extra.d / 2), inward(side))
  }

  if (options.stool && strip > 0) {
    const seat = specOf(options.stool)
    const spacing = seat.w + 0.65
    const seats = Math.max(1, Math.floor(run / spacing))
    const start = from + (run - (seats - 1) * spacing) / 2
    for (let i = 0; i < seats; i++) {
      const at = start + i * spacing
      const pos = onWall(wall, at, strip + spec.d + 0.15 + seat.d / 2)
      plan.seat(options.stool, pos, onWall(wall, at, strip), options.seatKind ?? 'sit-drink')
    }
  }
  return segments
}

/** How far the room runs back from one of its walls. */
function depthFrom(plan: RoomPlan, side: Side): number {
  return side === 'north' || side === 'south' ? plan.bounds.h : plan.bounds.w
}

/** Chairs drawn up to a table, each one facing it. */
export function seatTable(plan: RoomPlan, table: Placed, seats: number, kind: AnchorKind): number {
  const reach = 0.85
  let sat = 0
  for (const rot of plan.rng.shuffle([0, 90, 180, 270]).slice(0, seats)) {
    const away = dirOf(rot)
    const pos: Vec = { x: round(table.pos.x + away.x * reach), y: round(table.pos.y + away.y * reach) }
    if (plan.seat('chair', pos, table.pos, kind)) sat++
  }
  return sat
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

/** Something small in a corner: a plant, a lamp, whatever the room wants. */
export function cornerPiece(plan: RoomPlan, prop: FurnitureProp): Placed | undefined {
  for (const side of plan.openSides().reverse()) {
    const piece = plan.againstWall(prop, side, { prefer: 'ends', approach: 0.3, margin: 0.05 })
    if (piece) return piece
  }
  return undefined
}

/** Somewhere to lean and watch the room, out of the way of the door. */
export function leanSpot(plan: RoomPlan): boolean {
  const side = plan.openSides()[0]
  if (!side) return false
  const wall = wallOf(plan.bounds, side)
  const at = clamp(wall.from + (wall.to - wall.from) * plan.rng.range(0.15, 0.85), wall.from + 0.5, wall.to - 0.5)
  const pos = onWall(wall, at, 0.5)
  return plan.post('lean', pos, onWall(wall, at, 2))
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

/** Where a person stands to use a piece: in front of it, facing it. */
export function standAt(plan: RoomPlan, piece: Placed, kind: AnchorKind, gap = 0.55): boolean {
  const front = step(piece.pos, piece.rot, specOf(piece.prop).d / 2 + gap)
  return plan.post(kind, front, piece.pos, piece.id)
}
