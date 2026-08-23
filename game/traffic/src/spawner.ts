import { Rng } from '@gb/kit'
import { Car } from './car.ts'
import { distance, type Point } from './geometry.ts'
import type { Hazards } from './hazards.ts'
import { CITY_DRIVING } from './idm.ts'
import type { LaneGraph } from './lane-graph.ts'
import { join } from './queue.ts'
import { MODEL_MIX, type Settings } from './settings.ts'
import type { Lane } from './track.ts'

const ATTEMPTS = 6

/**
 * Puts cars on the road around the player and takes them away again. Every
 * choice comes off one seeded stream, so the same drive through the same city
 * meets the same traffic.
 */
export class Spawner {
  readonly #rng: Rng
  readonly #graph: LaneGraph
  readonly #settings: Settings
  readonly #hazards: Hazards
  readonly #carLength: number
  #slot = 0

  constructor(graph: LaneGraph, settings: Settings, hazards: Hazards, carLength: number) {
    this.#rng = new Rng(settings.seed).fork('traffic')
    this.#graph = graph
    this.#settings = settings
    this.#hazards = hazards
    this.#carLength = carLength
  }

  /** A car on a lane near the focus but not on top of it, or nothing if there is no room. */
  spawn(focus: Point, clock: number): Car | undefined {
    const s = this.#settings
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const lane = this.#rng.pick(this.#graph.lanes)
      const at = this.#rng.range(0, lane.length)
      const point = lane.path.pointAt(at)
      const away = distance(point, focus)
      if (away < s.minSpawnDistance || away > s.spawnRadius) continue
      if (!this.#clear(lane, at)) continue
      // and never on top of somebody, nor so close behind them that a car
      // arriving at the speed limit could not stop
      if (!this.#hazards.clearFor(lane, at, this.#stoppingRoom(lane))) continue
      const model = this.#rng.weighted(MODEL_MIX)
      const wish = lane.speedLimit * this.#rng.range(0.85, 1.1)
      const id = `car_${this.#slot}`
      const car = new Car(id, model, this.#slot, wish, this.#rng.fork(id), lane, at, clock)
      this.#slot++
      car.speed = car.desiredSpeed
      join(lane, car)
      return car
    }
    return undefined
  }

  /** A new car joins at the back of the lane: it never appears in front of one already driving. */
  #clear(lane: Lane, at: number): boolean {
    const room = this.#carLength + 4
    return lane.cars.every((car) => car.s > at + room)
  }

  /** Metres a car doing this lane's limit needs to come to a comfortable stop. */
  #stoppingRoom(lane: Lane): number {
    return this.#carLength / 2 + lane.speedLimit ** 2 / (2 * CITY_DRIVING.brake)
  }
}
