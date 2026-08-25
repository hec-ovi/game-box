import { Driver, type Handling } from './handling.ts'
import { buried, fits, patchesOf } from './geometry.ts'
import type { Blocking, DriveBody, DriveGround, DriveSolid, Moving, Point } from './ports.ts'

/**
 * The car the player owns: where it stands, what is drawn for it, and what
 * happens when it is asked to move somewhere a wall already is.
 *
 * Moving is tried whole, then one axis at a time, so a glancing hit on a
 * building slides along the wall instead of stopping the car dead, and a
 * head-on one stops it. Turning is tried on its own before either, so a car
 * wedged against a wall cannot rotate its nose into it.
 */
export class PlayerCar implements Moving {
  readonly id: string
  readonly model: string
  readonly driver: Driver
  readonly body: DriveBody | undefined

  x: number
  z: number

  constructor(input: {
    id: string
    model: string
    at: Point
    heading: number
    speed?: number
    body?: DriveBody
    tuning?: Handling
  }) {
    this.id = input.id
    this.model = input.model
    this.x = input.at.x
    this.z = input.at.z
    this.body = input.body
    this.driver = new Driver(input.tuning)
    this.driver.aim(input.heading, input.speed ?? 0)
  }

  get heading(): number {
    return this.driver.orientation
  }

  get speed(): number {
    return this.driver.speed
  }

  get roll(): number {
    return this.driver.roll
  }

  /**
   * Drive for a frame. Returns true when something solid was in the way, which
   * is the caller's cue that the car is not going anywhere.
   */
  drive(seconds: number, throttle: number, steer: number, solid: DriveSolid): boolean {
    const was = this.driver.orientation
    const stuck = buried(solid, this.x, this.z, was)
    const move = this.driver.step(seconds, throttle, steer)
    if (stuck > 0) return this.#dig(move, solid, stuck)

    if (!fits(solid, this.x, this.z, this.driver.orientation)) this.driver.orientation = was
    const heading = this.driver.orientation

    if (fits(solid, this.x + move.x, this.z + move.z, heading)) {
      this.x += move.x
      this.z += move.z
      return false
    }
    let slid = false
    if (fits(solid, this.x + move.x, this.z, heading)) {
      this.x += move.x
      slid = true
    }
    if (fits(solid, this.x, this.z + move.z, heading)) {
      this.z += move.z
      slid = true
    }
    if (!slid) this.driver.stop()
    return true
  }

  /**
   * Something solid is inside the car already: it was parked half on a wall, or
   * a building went up around it. Every pose reads as blocked, so the ordinary
   * rule would hold it there for good. Take any move that does not bury it
   * deeper, which lets it back out and cannot be used to drive further in.
   */
  #dig(move: Point, solid: DriveSolid, stuck: number): boolean {
    const heading = this.driver.orientation
    const tries: ReadonlyArray<readonly [number, number]> = [
      [this.x + move.x, this.z + move.z],
      [this.x + move.x, this.z],
      [this.x, this.z + move.z],
    ]
    for (const [x, z] of tries) {
      if (buried(solid, x, z, heading) <= stuck) {
        this.x = x
        this.z = z
        return false
      }
    }
    return true
  }

  /** Put what is drawn where the car is. The lean rides on the model, not the road. */
  show(ground: DriveGround): void {
    if (!this.body) return
    this.body.position.x = this.x
    this.body.position.y = ground(this.x, this.z)
    this.body.position.z = this.z
    this.body.rotation.y = this.heading
    this.body.rotation.z = this.roll
  }

  /** The car as circles somebody driving up behind it has to brake for. */
  patches(): Blocking[] {
    return patchesOf(this, this.heading)
  }
}
