import { aboard } from './geometry.ts'
import type { Point } from './ports.ts'

/** A place in the car, in its own frame: metres to the driver's left, metres forward. */
export interface Spot {
  readonly side: number
  readonly along: number
}

/** Left hand drive, four up, the back pair a seat's depth behind the front. */
export const DRIVER: Spot = { side: 0.38, along: 0.45 }
export const PASSENGERS: readonly Spot[] = [
  { side: -0.38, along: 0.15 },
  { side: 0.38, along: -0.85 },
  { side: -0.38, along: -0.85 },
]

/**
 * Where the driver's eye sits above the road. Higher than a passenger's, on
 * purpose: the cars are stylised and only a little over a metre tall, and this
 * is the height that puts the bonnet in the bottom quarter of the screen with
 * the road ahead in the middle. Nobody sees the driver, so what matters is the
 * view and not where a head would really be.
 */
export const EYE_HEIGHT = 1.16
/**
 * How far below the road a seated body's root goes. The cast's driving pose is
 * 1.44 m from its root to the crown of its head and the lowest roof in the car
 * pack is 1.15 m, so a body sat on the road wears the roof as a hat. Dropped
 * this far, every head is under every roof and the feet that go under the floor
 * are behind the underbody panel, where no daylight reaches.
 */
export const SEAT_DROP = -0.3

/** How much of the car's lean the eye takes. All of it in first person is seasick. */
export const EYE_ROLL = 0.45

/** Getting out: the doors, then the ends, in the order they are tried. */
export const DOORS: readonly Spot[] = [
  { side: 1.55, along: 0.15 },
  { side: -1.55, along: 0.15 },
  { side: 1.55, along: -1.6 },
  { side: -1.55, along: -1.6 },
  { side: 0, along: -3.4 },
  { side: 0, along: 3.4 },
]

export function spotAt(car: Point, heading: number, spot: Spot): Point {
  return aboard(car, heading, spot.side, spot.along)
}
