import type { DriveBodies, Driving, Moving, RoadTraffic } from '@gb/drive'
import type { PlayerState } from '@gb/play'
import { CAR_MODELS, METRICS, type CarModel } from '@gb/world'
import type { Rolling } from './bodies.ts'
import type { Vec2 } from './walk.ts'

/** The id the player's own car answers to: it is never one of the town's. */
const OWN_CAR = 'car_own'

/** How many patches a car is to a driver behind it, the way `@gb/drive` reports its own. */
const PATCHES = 3

/** The parked car as every reader of a car reads one: the traffic, the crowd and the walls. */
type Parked = { id: string; model: CarModel; x: number; z: number; heading: number; speed: number }

/**
 * The car a job paid out, standing at the kerb. `@gb/drive` only ever takes a
 * car off the road, so the one the player was given is put on the road here: it
 * is drawn from the same pool the traffic draws from, offered to the crosshair
 * on the same feed the traffic is offered on, and handed over the same way, so
 * getting into it is getting into any other car. Parked, it is solid to walk
 * into and something the traffic brakes for, like the one they left.
 */
export class Garage {
  #player: PlayerState
  #bodies: DriveBodies | undefined
  #driving: Driving
  #where: (model: CarModel) => Vec2
  #parked: { model: CarModel; x: number; z: number; heading: number } | undefined
  #body: { position: { x: number; y: number; z: number }; rotation: { y: number } } | undefined
  /** Answered into the same arrays every frame: the walls and the traffic read them once and keep nothing. */
  #standing: Parked[] = []
  #patches = Array.from({ length: PATCHES }, () => ({ x: 0, z: 0, radius: METRICS.vehicle.carWidth / 2 }))

  constructor(input: {
    player: PlayerState
    driving: Driving
    /** Where a car of theirs stands when it is put out: their own doorstep, or where they are. */
    where: (model: CarModel) => Vec2
  }) {
    this.#player = input.player
    this.#driving = input.driving
    this.#where = input.where
  }

  /** The pool the car body comes from, once the art has loaded. */
  open(bodies: DriveBodies): void {
    this.#bodies = bodies
    if (this.#parked) this.#draw()
  }

  /**
   * Put one of the player's cars out at the kerb. The playthrough holds which
   * cars are theirs and which one is out, so a car put out is out again when
   * the city is opened next.
   */
  putOut(model: CarModel): void {
    if (!this.#player.hasCar(model)) return
    this.#player.takeOutCar(model)
    const at = this.#where(model)
    this.#parked = { model, x: at.x, z: at.z, heading: 0 }
    this.#draw()
  }

  /** The car the save left out, back at the kerb where it was left. */
  restore(): void {
    const model = CAR_MODELS.find((each) => each === this.#player.carOut)
    if (model) this.putOut(model)
  }

  /**
   * The town's cars with the player's own among them. `@gb/drive` reads this
   * for what is in reach and takes what it is given; handing theirs over gives
   * the body back, because from that moment the car is the one they are in.
   */
  over(traffic: RoadTraffic): RoadTraffic {
    return {
      cars: () => {
        const parked = this.#view()
        return parked ? [...traffic.cars(), parked] : traffic.cars()
      },
      handOver: (carId: string) => {
        if (carId !== OWN_CAR) return traffic.handOver(carId)
        const parked = this.#view()
        this.#letGo()
        this.#parked = undefined
        return parked
      },
    }
  }

  /** The car, driving or parked, whichever of the two the player has. */
  get car(): Moving | undefined {
    return this.#driving.car ?? this.#view()
  }

  /** What the player walks into: the car they parked, or the one standing here waiting for them. */
  rolling(): readonly Rolling[] {
    const driven = this.#driving.rolling()
    if (driven.length > 0) return driven
    return this.#view() ? this.#standing : driven
  }

  /** What a driver behind brakes for. */
  inTheRoad(): readonly { x: number; z: number; radius: number }[] {
    const driven = this.#driving.inTheRoad()
    if (driven.length > 0 || !this.#parked) return driven
    const car = this.#parked
    const step = METRICS.vehicle.carLength / PATCHES
    for (const [index, patch] of this.#patches.entries()) {
      const along = (index - (PATCHES - 1) / 2) * step
      patch.x = car.x + Math.sin(car.heading) * along
      patch.z = car.z + Math.cos(car.heading) * along
    }
    return this.#patches
  }

  /** The parked car as everything that reads a car reads one. Nothing while none is out. */
  #view(): Parked | undefined {
    const car = this.#parked
    if (!car) return undefined
    const spot = (this.#standing[0] ??= { id: OWN_CAR, model: car.model, x: 0, z: 0, heading: 0, speed: 0 })
    spot.model = car.model
    spot.x = car.x
    spot.z = car.z
    spot.heading = car.heading
    this.#standing.length = 1
    return spot
  }

  #draw(): void {
    const car = this.#parked
    if (!car || !this.#bodies) return
    this.#letGo()
    this.#body = this.#bodies.acquire({ id: OWN_CAR, model: car.model })
    this.#body.position.x = car.x
    this.#body.position.z = car.z
    this.#body.rotation.y = car.heading
  }

  #letGo(): void {
    if (this.#body && this.#bodies && this.#parked) this.#bodies.release(this.#body, { id: OWN_CAR, model: this.#parked.model })
    this.#body = undefined
    this.#standing.length = 0
  }
}
