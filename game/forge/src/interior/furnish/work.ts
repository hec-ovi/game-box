import { headingTo, step } from '../geometry.ts'
import type { RoomPlan } from '../room-plan.ts'
import { cornerPiece, servePost, standAt, wallRow, workstation } from './pieces.ts'

/** An open office: desks in rows, all facing the same way, a chair and a screen at each. */
export function openOffice(plan: RoomPlan): void {
  const rot = plan.rng.pick([0, 90, 180, 270])
  let desks = 0
  for (const spot of plan.lattice(plan.bounds, { x: 2.2, y: 2.4 })) {
    if (desks >= 6) break
    const desk = plan.at('desk', spot, rot, 0, 0.4)
    if (!desk) continue
    desks++
    workstation(plan, desk, rot, 'terminal')
  }
  wallRow(plan, 'cabinet', plan.openSides()[0] ?? plan.backSide(), 2, 0.7)
  cornerPiece(plan, 'plant')
}

/** One person's office: the desk faces the door, the chair sits behind it, the screen on it faces the chair. */
export function privateOffice(plan: RoomPlan): void {
  for (const side of [plan.backSide(), ...plan.openSides()]) {
    const desk = plan.againstWall('desk', side, { gap: 0.9, approach: 0.8, prefer: 'centre' })
    if (!desk) continue
    workstation(plan, desk, desk.rot + 180, 'terminal')
    break
  }
  wallRow(plan, 'cabinet', plan.openSides()[0] ?? plan.backSide(), 1, 0.6)
  cornerPiece(plan, 'lamp')
}

/** A workshop: benches along the walls with room to work at them, crates behind. */
export function workshopFloor(plan: RoomPlan): void {
  servePost(plan)
  let benches = 0
  for (const side of plan.openSides()) {
    for (const bench of wallRow(plan, 'counter', side, 2, 1)) {
      if (standAt(plan, bench, 'work-bench')) benches++
    }
    if (benches >= 3) break
  }
  cornerPiece(plan, 'crate-stack')
  cornerPiece(plan, 'shelf')
}

/** A warehouse: stacks in aisles, shelves down the walls, somebody watching the door. */
export function warehouseFloor(plan: RoomPlan): void {
  let stacks = 0
  for (const spot of plan.lattice(plan.bounds, { x: 1.9, y: 2.1 })) {
    if (stacks >= 8) break
    if (plan.at('crate-stack', spot, 0, 0, 0.5)) stacks++
  }
  for (const side of plan.openSides().slice(0, 2)) wallRow(plan, 'shelf', side, 2, 0.8)
  const door = plan.doors[0]
  if (!door) return
  const across = headingTo(door.pos, plan.centre)
  for (const turn of [90, -90]) {
    if (plan.post('guard', step(door.inner, across + turn, 1.1), plan.centre)) break
  }
}
