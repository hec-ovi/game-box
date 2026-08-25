import { forwardOf, wrap } from './geometry.ts'
import type { Handling } from './handling.ts'
import type { ChaseView, DriveGround, DriveSolid, Moving, Point } from './ports.ts'

/**
 * Where the view sits behind the car. Metres, seconds and radians, and every
 * number is in `CONTRACT.md` with what it is for.
 */
export const CHASE_VIEW = {
  /** Behind the middle of the car when it is standing still. */
  back: 6.5,
  /** Added to that at the top speed, and nothing in reverse. */
  stretch: 2.5,
  /** Above the road under the car. */
  height: 2.6,
  /** Above the road under the car, where the view points: the roof line. */
  aim: 1.1,
  /** The nearest it is ever pulled by something behind it. */
  closest: 3,
  /** The nearest the eye ever gets to the ground directly under it. */
  clearance: 1.2,
  /** How far short of a wall behind it the view stops. */
  skin: 0.4,
  /** How finely the way back is sampled for walls. */
  probe: 0.5,
  /** How long the view takes to come round behind a turning car, and to let its distance back out. */
  ease: 0.3,
  /** How long the height takes to follow the ground under the car. */
  settle: 0.15,
} as const

/**
 * The view from behind the car: a point for the camera and a point for it to
 * look at, worked out each frame from where the car is, which way it points,
 * how fast it is going and what the ground and the walls are doing around it.
 *
 * Three things are eased rather than snapped, so a corner reads smoothly and
 * the tail does not whip: which way the view trails the car, how far back it
 * is, and how high the ground under the car has got. Pulling in for a wall is
 * the one thing that happens at once, because a frame late is a frame looking
 * at the inside of a building.
 */
export class Chase {
  readonly #tuning: Handling
  #yaw = 0
  #back: number = CHASE_VIEW.back
  #lift = 0
  #view: ChaseView | undefined

  constructor(tuning: Handling) {
    this.#tuning = tuning
  }

  /** Where the camera goes this frame. Nothing until a car has been aimed at. */
  get view(): ChaseView | undefined {
    return this.#view
  }

  /**
   * Put the view straight behind a car that has just been taken, with nothing
   * to ease from: the first frame behind the wheel is already settled.
   */
  aim(car: Moving, ground: DriveGround, walls?: DriveSolid): void {
    this.#yaw = car.heading
    this.#back = this.#wanted(car)
    this.#lift = ground(car.x, car.z)
    this.step(0, car, ground, walls)
  }

  /** One frame of it. */
  step(seconds: number, car: Moving, ground: DriveGround, walls?: DriveSolid): void {
    this.#yaw += wrap(car.heading - this.#yaw) * fade(seconds, CHASE_VIEW.ease)
    this.#lift += (ground(car.x, car.z) - this.#lift) * fade(seconds, CHASE_VIEW.settle)

    const wanted = this.#wanted(car)
    const eased = this.#back + (wanted - this.#back) * fade(seconds, CHASE_VIEW.ease)
    this.#back = Math.min(eased, clearBehind(car, this.#yaw, wanted, walls))

    this.#view = still(car, this.#yaw, this.#lift, this.#back, ground)
  }

  /** Settled at a stand, stretched with the speed forwards, settled again in reverse. */
  #wanted(car: Moving): number {
    const fast = Math.min(1, Math.max(0, car.speed) / this.#tuning.topSpeed)
    return CHASE_VIEW.back + CHASE_VIEW.stretch * fast
  }
}

/**
 * The view a car standing at this place, trailed from this angle, this far
 * back, over ground this high. The eye is lifted off the ground under the car
 * so the framing holds on a slope, and then floored against the ground
 * directly under it so it can never end up inside the road.
 */
function still(car: Point, yaw: number, lift: number, back: number, ground: DriveGround): ChaseView {
  const behind = forwardOf(yaw)
  const x = car.x - behind.x * back
  const z = car.z - behind.z * back
  return {
    eye: { x, y: Math.max(lift + CHASE_VIEW.height, ground(x, z) + CHASE_VIEW.clearance), z },
    at: { x: car.x, y: lift + CHASE_VIEW.aim, z: car.z },
    distance: back,
  }
}

/**
 * How far back there is room for. The way back is sampled from the closest the
 * view is ever pulled out to where it wants to be, and it stops a skin short of
 * the first wall. With nothing to ask, nothing is in the way.
 */
function clearBehind(car: Point, yaw: number, wanted: number, walls?: DriveSolid): number {
  if (!walls) return wanted
  const behind = forwardOf(yaw)
  const span = wanted - CHASE_VIEW.closest
  const steps = Math.max(1, Math.ceil(span / CHASE_VIEW.probe))
  for (let step = 0; step <= steps; step += 1) {
    const back = CHASE_VIEW.closest + (span * step) / steps
    if (walls(car.x - behind.x * back, car.z - behind.z * back)) {
      return Math.max(CHASE_VIEW.closest, back - CHASE_VIEW.skin)
    }
  }
  return wanted
}

/** How much of the way to the target one step of this length covers, at this time constant. */
function fade(seconds: number, tau: number): number {
  return seconds > 0 ? 1 - Math.exp(-seconds / tau) : 0
}
