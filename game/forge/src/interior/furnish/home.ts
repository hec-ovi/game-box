import { opposite, step } from '../geometry.ts'
import type { RoomPlan } from '../room-plan.ts'
import { cornerPiece, standAt, workstation } from './pieces.ts'

/** A living room: a sofa looking at the screen across the rug, and a desk with the household's laptop on it where a wall is free. */
export function livingRoom(plan: RoomPlan): void {
  for (const side of plan.openSides()) {
    const sofa = plan.againstWall('sofa', side, { prefer: 'centre', approach: 1 })
    if (!sofa) continue
    plan.anchor('sit', sofa.pos, sofa.rot, sofa.id)
    plan.at('rug', step(sofa.pos, sofa.rot, 1.4), sofa.rot)
    plan.againstWall('tv', opposite(side), { prefer: 'centre', approach: 0.5 })
    break
  }
  homeDesk(plan)
  if (plan.rng.chance(0.6)) cornerPiece(plan, 'lamp')
  cornerPiece(plan, 'shelf')
}

/** The desk in the corner with the laptop on it, the chair between it and the wall so whoever sits there faces the room. */
function homeDesk(plan: RoomPlan): void {
  for (const side of plan.openSides()) {
    const desk = plan.againstWall('desk', side, { prefer: 'ends', gap: 0.9, approach: 0.7 })
    if (!desk) continue
    workstation(plan, desk, desk.rot + 180, 'laptop')
    return
  }
}

/** A kitchen: the run of appliances along one wall, room to stand at the stove. */
export function kitchen(plan: RoomPlan): void {
  const side = plan.openSides()[0] ?? plan.backSide()
  const stove = plan.againstWall('stove', side, { prefer: 'centre', approach: 0.8 })
  plan.againstWall('sink', side, { prefer: 'any', approach: 0.7 })
  plan.againstWall('fridge', side, { prefer: 'ends', approach: 0.7 })
  plan.againstWall('counter', opposite(side), { prefer: 'any', approach: 0.7 })
  if (stove) standAt(plan, stove, 'cook')
}

/** A bedroom: the bed with its head to the wall, a wardrobe out of its way. */
export function bedroom(plan: RoomPlan): void {
  // the head of the bed goes against a short wall, where the room is deepest
  for (const side of [...plan.openSides()].reverse()) {
    const bed = plan.againstWall('bed', side, { prefer: 'centre', approach: 0.6 })
    if (!bed) continue
    plan.anchor('sleep', bed.pos, bed.rot, bed.id)
    plan.againstWall('wardrobe', opposite(side), { prefer: 'any', approach: 0.7 })
    break
  }
  cornerPiece(plan, 'lamp')
}

/** A bathroom: a sink, and nothing you would trip over. */
export function bathroom(plan: RoomPlan): void {
  const side = plan.openSides()[0] ?? plan.backSide()
  plan.againstWall('sink', side, { prefer: 'centre', approach: 0.6 })
  cornerPiece(plan, 'cabinet')
}

/** A hotel room: a bed, a wardrobe, and a desk if the room is big enough. */
export function guestRoom(plan: RoomPlan): void {
  bedroom(plan)
  const side = plan.openSides()[0]
  if (side) plan.againstWall('desk', side, { prefer: 'any', approach: 0.7 })
}
