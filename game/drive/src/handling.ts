import type { Point } from './ports.ts'

/** How a car answers the keys. Metres, seconds and radians throughout. */
export interface Handling {
  /** Fastest it will go forwards, metres per second. */
  readonly topSpeed: number
  /** And backwards. */
  readonly reverseSpeed: number
  /** Metres per second per second on the throttle. */
  readonly acceleration: number
  /** And on the brake, which is holding the other pedal down. */
  readonly braking: number
  /** And with nothing held: engine braking, so a car left alone rolls to a stop. */
  readonly coasting: number
  /** How far the front wheels turn standing still, radians. */
  readonly wheelLock: number
  /** How much of that lock is left at the top speed, as a fraction. */
  readonly lockAtSpeed: number
  /** How fast they get there, radians per second. */
  readonly wheelSpeed: number
  /** Radians of car per metre driven per radian of wheel: the tightness of a turn. */
  readonly steerRatio: number
  /** Radians of lean per (metre per second) per radian of wheel. */
  readonly rollScale: number
  /** How much of the speed a corner scrubs off, per radian of lean per second. */
  readonly cornerDrag: number
}

/**
 * A city car. The top speed is a little over the fastest road limit in town and
 * it gets there in about four seconds. At a crawl on full lock it comes round
 * inside six metres, which is what turning a junction between two six metre
 * roadways takes; flat out it has under a fifth of that lock and the same key
 * is a lane change. Above about ten metres a second the two together hold the
 * sideways pull roughly level, which is what a tyre does and what a car feels
 * like; below that the car turns tighter than a tyre would let it, which is
 * what makes parking and junctions possible.
 */
export const CITY_CAR: Handling = {
  topSpeed: 20,
  reverseSpeed: 6,
  acceleration: 5,
  braking: 10,
  coasting: 3,
  wheelLock: Math.PI / 6,
  lockAtSpeed: 0.18,
  wheelSpeed: 1.6,
  steerRatio: 0.35,
  rollScale: 0.018,
  cornerDrag: 40,
}

/**
 * How fast a car is going, which way the wheels are pointed and which way it is
 * facing: the whole of driving, and none of the world it drives through. The
 * turn rate is the distance covered times the wheel angle, so a car parked with
 * the wheel on full lock does not spin, and one at speed answers the wheel
 * hard. Leaning is the same product, which is why a fast corner leans and a
 * slow one does not.
 *
 * Nothing here knows about walls: `step` says where the car would like to be
 * and the caller is free to refuse it.
 */
export class Driver {
  readonly tuning: Handling
  /** Metres per second. Negative is reversing. */
  speed = 0
  /** Radians the front wheels are turned. Positive is left. */
  wheel = 0
  /** Radians around Y, nose down +Z. */
  orientation = 0
  /** Radians of lean, positive rolling onto the right hand side. */
  roll = 0

  constructor(tuning: Handling = CITY_CAR) {
    this.tuning = tuning
  }

  /** Put the car facing this way at this speed, with the wheels straight. */
  aim(orientation: number, speed = 0): void {
    this.orientation = orientation
    this.speed = speed
    this.wheel = 0
    this.roll = 0
  }

  /**
   * One step. `throttle` is 1 forwards, -1 backwards and 0 coasting; `steer` is
   * 1 left, -1 right and 0 letting the wheel come back. What comes out is how
   * far the car wants to move this frame.
   */
  step(seconds: number, throttle: number, steer: number): Point {
    if (!(seconds > 0)) return { x: 0, z: 0 }
    this.#turn(seconds, steer)

    const was = this.speed
    this.speed = this.#nextSpeed(seconds, throttle)
    const forward = ((was + this.speed) / 2) * seconds

    this.orientation += forward * this.tuning.steerRatio * this.wheel
    this.roll = this.speed * this.wheel * this.tuning.rollScale
    return { x: Math.sin(this.orientation) * forward, z: Math.cos(this.orientation) * forward }
  }

  /**
   * How much lock there is to be had right now: all of it standing still, a
   * fraction of it flat out. Without this the turn radius is the same at 5 and
   * at 20 metres per second, and a car at speed spins like a fairground ride.
   */
  get lock(): number {
    const { wheelLock, lockAtSpeed, topSpeed } = this.tuning
    const fast = Math.min(1, Math.abs(this.speed) / topSpeed)
    return wheelLock * (1 - fast * (1 - lockAtSpeed))
  }

  /** Something solid stopped the car. It does not bounce; it stands still. */
  stop(): void {
    this.speed = 0
    this.roll = 0
  }

  #turn(seconds: number, steer: number): void {
    const swing = this.tuning.wheelSpeed * seconds
    if (steer === 0) {
      this.wheel = Math.abs(this.wheel) <= swing ? 0 : this.wheel - Math.sign(this.wheel) * swing
    } else {
      this.wheel += Math.sign(steer) * swing
    }
    // clamped every step, not only when the wheel is being turned: pulling away
    // with the wheel already round has to unwind it as the speed comes up
    const room = this.lock
    this.wheel = clamp(this.wheel, -room, room)
  }

  #nextSpeed(seconds: number, throttle: number): number {
    const { topSpeed, reverseSpeed, acceleration, braking, coasting } = this.tuning
    // a corner scrubs speed off, which is what keeps a fast car from taking a
    // junction at the same speed it took the straight
    const scrub = Math.abs(this.roll) * this.tuning.cornerDrag * seconds

    if (throttle > 0) {
      const push = (this.speed < 0 ? braking : acceleration) * seconds
      return Math.min(topSpeed, this.speed + push - scrub)
    }
    if (throttle < 0) {
      const push = (this.speed > 0 ? braking : acceleration) * seconds
      return Math.max(-reverseSpeed, this.speed - push + scrub)
    }
    const drop = coasting * seconds + scrub
    return this.speed > 0 ? Math.max(0, this.speed - drop) : Math.min(0, this.speed + drop)
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}
