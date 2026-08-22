import { counterRun, cornerPiece, leanSpot, tableField } from './pieces.ts'
import type { RoomPlan } from '../room-plan.ts'

/** A bar: a counter you can walk behind, stools along it, tables in the rest. */
export function taproom(plan: RoomPlan): void {
  plan.crowdLimit = 6
  serveCounter(plan, 'bar-counter', 'bar-stool')
  tableField(plan, { seats: 2, kind: 'sit-drink', spacing: 2.6, max: 5, scattered: true })
  if (plan.rng.chance(0.6)) cornerPiece(plan, 'jukebox')
  if (plan.rng.chance(0.5)) leanSpot(plan)
}

/** A cafe: a service counter, a machine behind it, small tables. */
export function cafeFloor(plan: RoomPlan): void {
  serveCounter(plan, 'counter')
  const side = plan.openSides()[0]
  if (side) plan.againstWall('coffee-machine', side, { prefer: 'ends', approach: 0.4 })
  tableField(plan, { seats: 2, kind: 'sit', spacing: 2.4, max: 5 })
  cornerPiece(plan, 'plant')
}

/** A dining room: tables in rows, a till by the wall, nothing in the aisles. */
export function diningRoom(plan: RoomPlan): void {
  serveCounter(plan, 'counter')
  tableField(plan, { seats: 4, kind: 'sit', spacing: 2.8, max: 6 })
  cornerPiece(plan, 'plant')
}

/** Tries each open wall until one takes a counter. */
function serveCounter(plan: RoomPlan, prop: 'bar-counter' | 'counter', stool?: 'bar-stool'): boolean {
  for (const side of [plan.backSide(), ...plan.openSides()]) {
    const run = counterRun(plan, side, {
      prop,
      serve: 'serve',
      ...(stool ? { stool, seatKind: 'sit-drink' as const } : {}),
    })
    if (run.length) return true
  }
  return false
}
