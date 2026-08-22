import { headingTo, step } from '../geometry.ts'
import type { RoomPlan } from '../room-plan.ts'
import { wallRow } from './pieces.ts'

/** A store room: shelves round the walls, stacks in the middle, room to get in. */
export function storeRoom(plan: RoomPlan): void {
  for (const side of plan.openSides().slice(0, 2)) wallRow(plan, 'shelf', side, 2, 0.7)
  let stacks = 0
  for (const spot of plan.lattice(plan.bounds, { x: 1.8, y: 1.8 })) {
    if (stacks >= 3) break
    if (plan.at('crate-stack', spot, 0, 0, 0.6)) stacks++
  }
  const door = plan.doors[0]
  if (!plan.post('stand', plan.centre, door?.pos ?? step(plan.centre, 0, 1)) && door) {
    plan.post('stand', step(door.inner, headingTo(door.pos, plan.centre), 0.6), plan.centre)
  }
}

/** An entrance hall: keep it walkable, put the coat stand out of the line. */
export function entranceHall(plan: RoomPlan): void {
  for (const side of plan.openSides().slice(0, 1)) {
    plan.againstWall('cabinet', side, { prefer: 'ends', approach: 0.6 })
  }
  if (plan.rng.chance(0.5)) {
    const side = plan.openSides()[0]
    if (side) plan.againstWall('plant', side, { prefer: 'ends', approach: 0.3, margin: 0.05 })
  }
}
