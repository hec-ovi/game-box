import { Rng } from '@gb/kit'
import { METRICS } from '@gb/world'
import type { CarView, Lane, Obstacle, Obstacles, Point } from '../src/index.ts'

const HALF_LENGTH = METRICS.vehicle.carLength / 2
const HALF_WIDTH = METRICS.vehicle.carWidth / 2
/** How close a person gets to a car before they stop walking into it. */
const SHY = 0.05

/** Metres from a point to a car's rectangle, and zero inside it. */
export function clearance(car: CarView, p: Point): number {
  const dx = p.x - car.x
  const dz = p.z - car.z
  const along = dx * Math.sin(car.heading) + dz * Math.cos(car.heading)
  const across = -dx * Math.cos(car.heading) + dz * Math.sin(car.heading)
  return Math.hypot(Math.max(0, Math.abs(along) - HALF_LENGTH), Math.max(0, Math.abs(across) - HALF_WIDTH))
}

/** Where a point sits relative to a car: metres up the road, metres off to the side. */
export function relative(car: CarView, p: Point): { along: number; across: number } {
  const dx = p.x - car.x
  const dz = p.z - car.z
  return { along: dx * Math.sin(car.heading) + dz * Math.cos(car.heading), across: -dx * Math.cos(car.heading) + dz * Math.sin(car.heading) }
}

/**
 * One person walking the streets the way the player does: to a spot on or
 * beside a road, a pause there, then on to the next, sometimes at a run. They
 * never step into a car, so a car that ends up on them drove there.
 */
export class Walker implements Obstacles, Obstacle {
  x: number
  z: number
  readonly radius = 0.5
  readonly #rng: Rng
  readonly #spots: Obstacle[] = [this]
  #lanes: readonly Lane[] = []
  #target: Point | undefined
  #rest = 0
  #pace = 2

  constructor(seed: string, start: Point) {
    this.#rng = new Rng(seed).fork('walker')
    this.x = start.x
    this.z = start.z
  }

  /** The streets to wander, once the traffic that will read this walker has built them. */
  roam(lanes: readonly Lane[]): void {
    this.#lanes = lanes
  }

  near(): readonly Obstacle[] {
    return this.#spots
  }

  step(dt: number, cars: readonly CarView[]): void {
    if (this.#rest > 0) {
      this.#rest -= dt
      return
    }
    if (!this.#target || Math.hypot(this.#target.x - this.x, this.#target.z - this.z) < 0.2) this.#choose()
    if (this.#rest > 0) return
    const target = this.#target!
    const dx = target.x - this.x
    const dz = target.z - this.z
    const len = Math.hypot(dx, dz)
    const move = Math.min(len, this.#pace * dt)
    const next = { x: this.x + (dx / len) * move, z: this.z + (dz / len) * move }
    if (!cars.every((car) => clearance(car, next) > this.radius + SHY)) return
    this.x = next.x
    this.z = next.z
  }

  /** Somewhere on or beside a road, up to seven metres off a lane: the lane, the oncoming one, the pavements. */
  #choose(): void {
    if (this.#target) this.#rest = this.#rng.range(0, 5)
    const lane = this.#rng.pick(this.#lanes)
    const s = this.#rng.range(0, lane.length)
    const on = lane.path.pointAt(s)
    const d = lane.path.directionAt(s)
    const off = this.#rng.range(-7, 7)
    this.#target = { x: on.x - d.z * off, z: on.z + d.x * off }
    this.#pace = this.#rng.range(0, 1) < 0.25 ? 5 : 2
  }
}
