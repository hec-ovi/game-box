import { METRICS } from '@gb/world'
import { Cabin, doorFor } from './cabin.ts'
import { PlayerCar } from './car.ts'
import { away, HALF_LENGTH, HALF_WIDTH, aboard, forwardOf, leftOf } from './geometry.ts'
import type { Handling } from './handling.ts'
import { nameOf } from './names.ts'
import type {
  Blocking,
  DriveBodies,
  DriveGround,
  DriveSolid,
  DriveTarget,
  Point,
  Rider,
  Riders,
  RoadTraffic,
  Moving,
  Rolling,
} from './ports.ts'
import { DRIVER, EYE_HEIGHT, EYE_ROLL, spotAt } from './seats.ts'

/**
 * How far the player walks from the car they left before it is given back to
 * the pool. Past this it is out of sight and holding a scene object for it
 * costs a draw for nothing; the streets are full of others.
 */
const FORGET_RADIUS = 200

const FLAT: DriveGround = () => 0

export interface DrivingDeps {
  /** The player. `@gb/app`'s first person body is one. */
  readonly rider: Rider
  /** What the car cannot drive through: walls, water, people, other traffic. */
  readonly solid: DriveSolid
  /** How high the road is. Flat if nothing says otherwise. */
  readonly ground?: DriveGround
  /** The cars driving themselves. With none there is nothing to get into. */
  readonly traffic?: RoadTraffic
  /** Where the car object comes from. With none the car drives but is not drawn. */
  readonly bodies?: DriveBodies
  /** The companions. With none the player drives alone. */
  readonly riders?: Riders
  /** False while the player is inside a building, where there are no cars. */
  readonly outdoors?: () => boolean
  /** How the car answers the keys. */
  readonly tuning?: Handling
}

/**
 * The car the player drives. One at a time: walk up to anything on the road,
 * press the key, and it stops being the traffic's and starts being yours,
 * companions and all. Press it again and everybody gets out on the pavement
 * beside it.
 *
 * The keys are the same keys walking uses, read off the player rather than
 * bound here, so nothing in this box touches a browser.
 */
export class Driving {
  readonly #rider: Rider
  readonly #solid: DriveSolid
  readonly #ground: DriveGround
  #traffic: RoadTraffic | undefined
  #bodies: DriveBodies | undefined
  readonly #outdoors: () => boolean
  readonly #tuning: Handling | undefined
  readonly #cabin: Cabin
  #car: PlayerCar | undefined
  #driving = false

  constructor(deps: DrivingDeps) {
    this.#rider = deps.rider
    this.#solid = deps.solid
    this.#ground = deps.ground ?? FLAT
    this.#traffic = deps.traffic
    this.#bodies = deps.bodies
    this.#outdoors = deps.outdoors ?? (() => true)
    this.#tuning = deps.tuning
    this.#cabin = new Cabin(deps.riders)
  }

  /**
   * The cars have arrived. Their art loads a moment after the city is on
   * screen, so a game that draws before it downloads builds this box with no
   * traffic in it and hands the traffic over here. Until then there is nothing
   * to get into, which is exactly what a city with no cars in it is.
   */
  open(traffic: RoadTraffic, bodies?: DriveBodies): void {
    this.#traffic = traffic
    if (bodies) this.#bodies = bodies
  }

  /** True while the player is behind the wheel. */
  get aboard(): boolean {
    return this.#driving
  }

  /** The player's car, driving or parked. */
  get car(): Moving | undefined {
    return this.#car
  }

  /** Who is riding with the player, by npc id. */
  passengers(): readonly string[] {
    return this.#cabin.aboard()
  }

  /** What the crosshair offers: the car in front of you, or the door out of it. */
  target(): DriveTarget | undefined {
    if (this.#driving && this.#car) {
      const eye = spotAt(this.#car, this.#car.heading, DRIVER)
      return { kind: 'drive', id: this.#car.id, label: 'Get out', at: eye }
    }
    if (!this.#outdoors()) return undefined
    const near = this.#nearest()
    if (!near) return undefined
    return { kind: 'drive', id: near.car.id, label: `Get in the ${nameOf(near.car.model)}`, at: near.at }
  }

  /** Get in, or get out. Whichever the crosshair was offering. */
  act(): void {
    if (this.#driving) {
      this.#leave()
      return
    }
    const near = this.#nearest()
    if (near) this.#board(near.car.id)
  }

  /** One frame of driving. Does nothing at all while the player is on foot. */
  update(seconds: number): void {
    const car = this.#car
    if (!car) return
    if (!this.#driving) {
      if (away(car, this.#rider.position) > FORGET_RADIUS) this.#forget()
      return
    }

    const before = car.heading
    const keys = this.#rider.input
    car.drive(seconds, keys.forward, -keys.strafe, this.#solid)
    car.show(this.#ground)
    this.#cabin.carry(car, car.heading, this.#ground)
    this.#sit(wrap(car.heading - before))
  }

  /** The player's car as something you cannot walk through, when nobody is in it. */
  rolling(): readonly Rolling[] {
    return this.#car && !this.#driving ? [this.#car] : []
  }

  /** The player's car as patches of road the traffic has to brake for. */
  inTheRoad(): readonly Blocking[] {
    return this.#car ? this.#car.patches() : []
  }

  /** Give the car and everybody in it back. The player is left standing where they are. */
  dispose(): void {
    this.#cabin.clear()
    this.#forget()
    this.#driving = false
  }

  /** The car within reach, and the point on it the player would reach for. */
  #nearest(): { car: PlayerCar | (Rolling & { id: string; model: string }); at: Point } | undefined {
    const from = this.#rider.position
    let best: { car: PlayerCar | (Rolling & { id: string; model: string }); at: Point; gap: number } | undefined
    const consider = (car: PlayerCar | (Rolling & { id: string; model: string })): void => {
      const at = nearestOn(car, car.heading, from)
      const gap = away(at, from)
      if (gap > METRICS.player.interactRange) return
      if (!best || gap < best.gap) best = { car, at, gap }
    }
    if (this.#car) consider(this.#car)
    for (const car of this.#traffic?.cars() ?? []) consider(car)
    return best
  }

  #board(carId: string): void {
    if (this.#car?.id !== carId) {
      const taken = this.#traffic?.handOver(carId)
      if (!taken) return
      this.#forget()
      this.#car = new PlayerCar({
        id: taken.id,
        model: taken.model,
        at: taken,
        heading: taken.heading,
        speed: taken.speed,
        ...(this.#bodies ? { body: this.#bodies.acquire({ id: taken.id, model: taken.model }) } : {}),
        ...(this.#tuning ? { tuning: this.#tuning } : {}),
      })
    }
    const car = this.#car!
    this.#driving = true
    this.#cabin.board()
    car.show(this.#ground)
    this.#cabin.carry(car, car.heading, this.#ground)
    // whichever way they were looking when they opened the door, they are
    // looking out of the windscreen once they are behind the wheel
    this.#sit(wrap(car.heading + Math.PI - this.#rider.heading))
  }

  #leave(): void {
    const car = this.#car
    if (!car) return
    this.#driving = false
    car.driver.stop()
    car.show(this.#ground)

    const out = doorFor(car, car.heading, this.#solid, []) ?? { x: car.x, z: car.z }
    this.#rider.ride(undefined)
    // the app's heading is the other way round from a car's: 0 looks north
    this.#rider.placeAt(out.x, out.z, car.heading + Math.PI)
    this.#cabin.alight(car, car.heading, this.#solid, [out])
  }

  #sit(turned: number): void {
    const car = this.#car!
    const eye = spotAt(car, car.heading, DRIVER)
    this.#rider.ride({
      x: eye.x,
      y: this.#ground(car.x, car.z) + EYE_HEIGHT,
      z: eye.z,
      turned,
      roll: car.roll * EYE_ROLL,
    })
  }

  #forget(): void {
    const car = this.#car
    if (!car) return
    if (car.body && this.#bodies) this.#bodies.release(car.body, { id: car.id, model: car.model })
    this.#car = undefined
  }
}

/** The point on a car's outline closest to somebody standing outside it. */
export function nearestOn(car: Point, heading: number, from: Point): Point {
  const dx = from.x - car.x
  const dz = from.z - car.z
  const forward = forwardOf(heading)
  const left = leftOf(heading)
  const along = clamp(dx * forward.x + dz * forward.z, -HALF_LENGTH, HALF_LENGTH)
  const side = clamp(dx * left.x + dz * left.z, -HALF_WIDTH, HALF_WIDTH)
  return aboard(car, heading, side, along)
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

/** An angle difference brought back into -pi..pi. */
function wrap(angle: number): number {
  return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2))
}
