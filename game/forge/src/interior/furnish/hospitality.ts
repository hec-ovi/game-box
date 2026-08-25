import { cornerPiece, danceFloor, leanSpots, servePost, tableField, wallScreen } from './pieces.ts'
import type { RoomPlan } from '../room-plan.ts'

/** What a taproom is asked to hold beyond its counter and its tables. */
export interface TaproomOptions {
  /** Whether the town's own story calls for dancing: then the floor between the tables gets dancers. */
  readonly dancing: boolean
}

/** A bar: a counter you can walk behind, drinkers on the stools, the bar's game screen beside the till, tables in the rest. */
export function taproom(plan: RoomPlan, options: TaproomOptions): void {
  plan.crowdLimit = 6
  servePost(plan, { prop: 'bar-counter', stool: 'bar-stool', onTop: 'register', screen: 'monitor' })
  // before the screen and the tables, so the propped bodies get the free wall
  // and the room is not everybody sitting down
  leanSpots(plan, plan.rng.int(1, 3))
  wallScreen(plan)
  if (options.dancing) danceFloor(plan, 2)
  tableField(plan, { seats: 2, kind: 'sit', spacing: 2.6, max: 5, scattered: true })
  if (plan.rng.chance(0.6)) cornerPiece(plan, 'jukebox')
}

/** A cafe: a service counter and small tables. */
export function cafeFloor(plan: RoomPlan): void {
  servePost(plan, { onTop: 'coffee-machine' })
  leanSpots(plan, plan.rng.int(1, 3))
  wallScreen(plan)
  tableField(plan, { seats: 2, kind: 'sit', spacing: 2.4, max: 5 })
  cornerPiece(plan, 'plant')
}

/** A dining room: tables in rows, a counter by the wall, nothing in the aisles. */
export function diningRoom(plan: RoomPlan): void {
  servePost(plan)
  wallScreen(plan)
  tableField(plan, { seats: 4, kind: 'sit', spacing: 2.8, max: 6 })
  cornerPiece(plan, 'plant')
}
