import type { Rng } from '@gb/kit'
import type { CarBody } from './bodies.ts'
import { headingOf } from './geometry.ts'
import type { CarModel } from './settings.ts'
import type { Lane, Link, Track } from './track.ts'

/** What a car looks like from outside the box: where it is and how fast. */
export interface CarView {
  readonly id: string
  readonly model: CarModel
  readonly x: number
  readonly z: number
  /** Rotation around Y, radians, for a model whose nose points down +Z. */
  readonly heading: number
  /** Metres per second. */
  readonly speed: number
  /** The piece of road it is on: a lane, or the way across a junction. */
  readonly trackId: string
}

/**
 * One car: which piece of road it is on, how far along, how fast, and where
 * that puts it. Position is worked out when it moves and kept, so reading a
 * hundred cars a frame costs a hundred property reads.
 */
export class Car implements CarView {
  readonly id: string
  readonly model: CarModel
  /** Spawn order. Far cars are updated on the frame that matches their slot. */
  readonly slot: number
  readonly wish: number
  /** Its own stream, forked from the traffic seed, for the turns it takes. */
  readonly rng: Rng

  track: Track
  s: number
  speed = 0
  /** The way through the next junction, chosen on approach. */
  next: Link | undefined
  /** The junction this car has been given, held until it is through. */
  holds: string | undefined
  /** Sim time it first asked for that junction, which is how ties are broken. */
  claimedAt = 0
  /** Acceleration decided this step, applied in the move pass. */
  accel = 0
  /** Seconds it has been standing still, which is how a jam gets cleaned up. */
  stalled = 0
  /** Sim time this car last moved, so a car updated every third frame catches up. */
  clock: number
  body: CarBody | undefined

  x = 0
  z = 0
  heading = 0

  constructor(
    id: string,
    model: CarModel,
    slot: number,
    wish: number,
    rng: Rng,
    track: Lane,
    s: number,
    clock: number,
  ) {
    this.id = id
    this.model = model
    this.slot = slot
    this.wish = wish
    this.rng = rng
    this.track = track
    this.s = s
    this.clock = clock
    this.place()
  }

  get trackId(): string {
    return this.track.id
  }

  /** How fast it would like to go here: its own wish, held to the road limit. */
  get desiredSpeed(): number {
    return Math.min(this.wish, this.track.speedLimit)
  }

  /** Metres of this track still in front of it. */
  get remaining(): number {
    return this.track.length - this.s
  }

  place(): void {
    const p = this.track.path.pointAt(this.s)
    this.x = p.x
    this.z = p.z
    this.heading = headingOf(this.track.path.directionAt(this.s))
  }
}
