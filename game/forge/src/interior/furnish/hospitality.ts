import { cornerPiece, leanSpot, servePost, tableField } from './pieces.ts'
import type { RoomPlan } from '../room-plan.ts'

/** A bar: a counter you can walk behind, stools along it, tables in the rest. */
export function taproom(plan: RoomPlan): void {
  plan.crowdLimit = 6
  servePost(plan, { prop: 'bar-counter', stool: 'bar-stool' })
  tableField(plan, { seats: 2, kind: 'sit-drink', spacing: 2.6, max: 5, scattered: true })
  if (plan.rng.chance(0.6)) cornerPiece(plan, 'jukebox')
  if (plan.rng.chance(0.5)) leanSpot(plan)
}

/** A cafe: a service counter and small tables. */
export function cafeFloor(plan: RoomPlan): void {
  servePost(plan)
  tableField(plan, { seats: 2, kind: 'sit', spacing: 2.4, max: 5 })
  cornerPiece(plan, 'plant')
}

/** A dining room: tables in rows, a counter by the wall, nothing in the aisles. */
export function diningRoom(plan: RoomPlan): void {
  servePost(plan)
  tableField(plan, { seats: 4, kind: 'sit', spacing: 2.8, max: 6 })
  cornerPiece(plan, 'plant')
}
