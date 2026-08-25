import { headingTo, inward, norm, shrinkFrom, step, type Side } from '../geometry.ts'
import { specOf } from '../props.ts'
import type { RoomPlan } from '../room-plan.ts'
import { standoff } from '../stance.ts'
import { cornerPiece, servePost, standAt, tableField, wallRow, wallScreen } from './pieces.ts'

/** Floor one bed and the room to walk round it take: how many a ward holds is its area over this. */
const FLOOR_PER_BED = 12

/** The most beds one ward is worth, however big the room. */
const MOST_BEDS = 8

/** A room you wait in: a desk to report to, chairs along the wall. */
export function waitingRoom(plan: RoomPlan): void {
  plan.crowdLimit = 3
  const desk = servePost(plan)
  wallScreen(plan)
  benchRow(plan, 3, desk)
  cornerPiece(plan, 'plant')
}

/** A ward: beds along the walls with room to walk round them, as many as the floor holds, a sink, a cabinet. */
export function ward(plan: RoomPlan): void {
  const wanted = Math.max(1, Math.min(MOST_BEDS, Math.floor((plan.bounds.w * plan.bounds.h) / FLOOR_PER_BED)))
  let beds = 0
  for (const side of plan.openSides()) {
    for (const bed of wallRow(plan, 'bed', side, wanted - beds, 0.7)) {
      beds++
      plan.anchor('sleep', bed.pos, bed.rot, bed.id)
    }
    if (beds >= wanted) break
  }
  const side = plan.openSides()[0]
  if (side) {
    const sink = plan.againstWall('sink', side, { prefer: 'ends', approach: 0.6 })
    if (sink) standAt(plan, sink, 'stand')
  }
  cornerPiece(plan, 'cabinet')
}

/** A hotel lobby: a reception desk, somewhere to sit, a plant. */
export function lobby(plan: RoomPlan): void {
  plan.crowdLimit = 3
  const desk = servePost(plan)
  wallScreen(plan)
  const side = plan.openSides().find((open) => open !== desk)
  if (side) {
    const sofa = plan.againstWall('sofa', side, { prefer: 'centre', approach: 0.9 })
    if (sofa) plan.anchor('sit', sofa.pos, sofa.rot, sofa.id)
  }
  tableField(plan, { seats: 2, kind: 'sit', spacing: 2.6, max: 1 })
  cornerPiece(plan, 'plant')
}

/** A concourse: a ticket desk, rows of benches, somebody keeping an eye on it. */
export function concourse(plan: RoomPlan): void {
  plan.crowdLimit = 4
  const desk = servePost(plan)
  wallScreen(plan)
  benchRow(plan, 4, desk)
  const door = plan.doors[0]
  if (door) {
    const across = headingTo(door.pos, plan.centre)
    for (const turn of [90, -90]) if (plan.post('guard', step(door.inner, across + turn, 1.2), plan.centre)) break
  }
  cornerPiece(plan, 'plant')
}

/** An assembly: ranks of seats all facing a piece at the front, and somebody standing at it facing them. */
export function assembly(plan: RoomPlan): void {
  plan.crowdLimit = 8
  const front = plan.backSide()
  const piece = plan.againstWall('table', front, { prefer: 'centre', approach: 1.2 })
  const outwards = inward(front)
  if (piece) {
    // in front of the piece, facing the ranks rather than the wall behind it
    const spot = step(piece.pos, outwards, specOf(piece.prop).d / 2 + standoff('stand'))
    plan.post('stand', spot, step(spot, outwards, 2), piece.id)
  }
  let seats = 0
  for (const spot of plan.lattice(shrinkFrom(plan.bounds, front, 2), { x: 1.1, y: 1.1 })) {
    if (seats >= 16) break
    const seat = plan.at('chair', spot, norm(outwards + 180))
    if (!seat) continue
    seats++
    plan.anchor('sit', seat.pos, seat.rot, seat.id)
  }
  cornerPiece(plan, 'lamp')
}

/** Chairs against a wall, all facing the room, away from the counter. */
function benchRow(plan: RoomPlan, count: number, avoid?: Side): void {
  const side = plan.openSides().find((open) => open !== avoid)
  if (!side) return
  for (const seat of wallRow(plan, 'chair', side, count, 0.7)) {
    plan.anchor('sit', seat.pos, seat.rot, seat.id)
  }
}
