import { headingTo, inward, norm, shrinkFrom, step, type Side } from '../geometry.ts'
import type { RoomPlan } from '../room-plan.ts'
import { cornerPiece, counterRun, standAt, tableField, wallRow } from './pieces.ts'

/** A room you wait in: a desk to report to, chairs along the wall. */
export function waitingRoom(plan: RoomPlan): void {
  plan.crowdLimit = 3
  benchRow(plan, 3, reception(plan))
  cornerPiece(plan, 'plant')
}

/** A treatment room: beds with room to walk round them, a sink, a cabinet. */
export function treatmentRoom(plan: RoomPlan): void {
  let beds = 0
  for (const side of plan.openSides()) {
    const bed = plan.againstWall('bed', side, { prefer: 'any', approach: 0.7 })
    if (!bed) continue
    beds++
    plan.anchor('sleep', bed.pos, bed.rot, bed.id)
    if (beds >= 2) break
  }
  const side = plan.openSides()[0]
  if (side) {
    const sink = plan.againstWall('sink', side, { prefer: 'ends', approach: 0.6 })
    if (sink) standAt(plan, sink, 'stand', 0.5)
  }
  cornerPiece(plan, 'cabinet')
}

/** A hotel lobby: a reception desk, somewhere to sit, a plant. */
export function lobby(plan: RoomPlan): void {
  plan.crowdLimit = 3
  const desk = reception(plan)
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
  benchRow(plan, 4, reception(plan))
  const door = plan.doors[0]
  if (door) {
    const across = headingTo(door.pos, plan.centre)
    for (const turn of [90, -90]) if (plan.post('guard', step(door.inner, across + turn, 1.2), plan.centre)) break
  }
  cornerPiece(plan, 'plant')
}

/** A nave: rows of pews all facing the altar, and somewhere to stand in front of it. */
export function nave(plan: RoomPlan): void {
  plan.crowdLimit = 8
  const front = plan.backSide()
  const altar = plan.againstWall('table', front, { prefer: 'centre', approach: 1.2 })
  const outwards = inward(front)
  if (altar) {
    const spot = step(altar.pos, outwards, 0.8)
    plan.post('stand', spot, step(spot, outwards, 2), altar.id)
  }
  let pews = 0
  for (const spot of plan.lattice(shrinkFrom(plan.bounds, front, 2), { x: 1.1, y: 1.1 })) {
    if (pews >= 16) break
    const pew = plan.at('chair', spot, norm(outwards + 180))
    if (!pew) continue
    pews++
    plan.anchor('sit', pew.pos, pew.rot, pew.id)
  }
  cornerPiece(plan, 'lamp')
}

/** A counter somebody staffs, and the wall it ended up on. */
function reception(plan: RoomPlan): Side | undefined {
  for (const side of [plan.backSide(), ...plan.openSides()]) {
    if (counterRun(plan, side, { prop: 'counter', serve: 'serve' }).length) return side
  }
  return undefined
}

/** Chairs against a wall, all facing the room, away from the counter. */
function benchRow(plan: RoomPlan, count: number, avoid?: Side): void {
  const side = plan.openSides().find((open) => open !== avoid)
  if (!side) return
  for (const seat of wallRow(plan, 'chair', side, count, 0.7)) {
    plan.anchor('sit', seat.pos, seat.rot, seat.id)
  }
}
