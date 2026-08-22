import { shrinkFrom, type Side } from '../geometry.ts'
import type { RoomPlan } from '../room-plan.ts'
import { cornerPiece, counterRun, standAt, wallRow } from './pieces.ts'

/** A shop: a till you queue at, cases along the walls to look through. */
export function shopFloor(plan: RoomPlan): void {
  plan.crowdLimit = 3
  till(plan)
  for (const side of plan.openSides()) {
    for (const piece of wallRow(plan, 'display-case', side, 2, 0.9)) standAt(plan, piece, 'browse', 0.6)
  }
  wallRow(plan, 'shelf', plan.openSides()[0] ?? plan.backSide(), 2, 0.8)
}

/** A market hall: stalls out on the floor with room to walk between them. */
export function marketHall(plan: RoomPlan): void {
  plan.crowdLimit = 4
  const counter = till(plan)
  const floor = counter ? shrinkFrom(plan.bounds, counter, 2.2) : plan.bounds
  const stalls = plan.lattice(floor, { x: 2.6, y: 2.4 })
  let placed = 0
  for (const spot of stalls) {
    if (placed >= 5) break
    const rot = plan.rng.pick([0, 180])
    const stall = plan.at('display-case', spot, rot, 0, 0.6)
    if (!stall) continue
    placed++
    standAt(plan, stall, 'browse', 0.6)
  }
  cornerPiece(plan, 'crate-stack')
}

/** The till, and the wall it ended up on. */
function till(plan: RoomPlan): Side | undefined {
  for (const side of [plan.backSide(), ...plan.openSides()]) {
    if (counterRun(plan, side, { prop: 'counter', serve: 'serve', extra: 'register' }).length) return side
  }
  return undefined
}
