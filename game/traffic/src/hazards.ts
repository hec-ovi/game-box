import { METRICS } from '@gb/world'
import type { Car } from './car.ts'
import { distance, type Point } from './geometry.ts'
import type { Obstacle, Obstacles } from './obstacles.ts'
import { Link, type Track } from './track.ts'

/** How much road somebody takes up when the port does not say. Metres. */
const PERSON_RADIUS = 0.5
/** Half a car across: what the front of the car would actually hit. */
const HALF_WIDTH = METRICS.vehicle.carWidth / 2
/** Half a car along: the gap is measured from its nose, not its middle. */
const HALF_LENGTH = METRICS.vehicle.carLength / 2

const NOBODY: readonly Obstacle[] = []

/**
 * The people, in terms a car understands: for every stretch of road a car is on
 * or about to enter, how far along it somebody is standing. Built fresh each
 * update from the `Obstacles` port, so a person stepping back onto the pavement
 * clears the road the same frame.
 *
 * Only the roads cars are actually on are searched, so the work is the cars
 * being updated times the people near them, not the whole city.
 */
export class Hazards {
  readonly #source: Obstacles | undefined
  /** Track id to the near edge of everybody on it, in metres along, sorted. */
  readonly #onTrack = new Map<string, number[]>()
  readonly #tracks = new Map<string, Track>()
  #people: readonly Obstacle[] = NOBODY

  constructor(source: Obstacles | undefined) {
    this.#source = source
  }

  /** Read the people once, and file them under the roads these cars are driving. */
  refresh(due: readonly Car[], focus: Point, radius: number): void {
    this.#onTrack.clear()
    this.#people = this.#source ? this.#source.near(focus, radius) : NOBODY
    if (this.#people.length === 0 || due.length === 0) return

    this.#tracks.clear()
    for (const car of due) {
      this.#tracks.set(car.track.id, car.track)
      const next = beyond(car)
      if (next) this.#tracks.set(next.id, next)
    }
    for (const track of this.#tracks.values()) {
      const edges = blockersOn(track, this.#people)
      if (edges) this.#onTrack.set(track.id, edges)
    }
  }

  /**
   * Nobody in the way of a car appearing at `at` metres along this track and
   * driving on for `room` more, which is what a new car needs: one cannot be
   * dropped onto somebody, nor so close behind them that it cannot stop.
   */
  clearFor(track: Track, at: number, room: number): boolean {
    for (const person of this.#people) {
      const wide = person.radius ?? PERSON_RADIUS
      const { s, off } = track.path.nearestTo(person)
      if (off > HALF_WIDTH + wide) continue
      if (s > at - HALF_LENGTH - wide && s < at + room) return false
    }
    return true
  }

  /**
   * Metres of clear road in front of this car's nose before somebody is
   * standing in it, looking one track ahead the way the car in front is
   * looked for. Infinity when the road is clear.
   */
  gapFor(car: Car): number {
    if (this.#onTrack.size === 0) return Number.POSITIVE_INFINITY
    const here = this.#firstAfter(car.track.id, car.s)
    if (here !== undefined) return here - car.s - HALF_LENGTH
    const next = beyond(car)
    if (!next) return Number.POSITIVE_INFINITY
    const there = this.#firstAfter(next.id, Number.NEGATIVE_INFINITY)
    return there === undefined ? Number.POSITIVE_INFINITY : car.remaining + there - HALF_LENGTH
  }

  #firstAfter(trackId: string, s: number): number | undefined {
    const edges = this.#onTrack.get(trackId)
    if (!edges) return undefined
    for (const edge of edges) if (edge > s) return edge
    return undefined
  }
}

/** The piece of road this car drives onto next, if it has chosen one. */
function beyond(car: Car): Track | undefined {
  return car.track instanceof Link ? car.track.to : car.next
}

/** Where each person's near edge falls along this track, if they are in the way of a car on it. */
function blockersOn(track: Track, people: readonly Obstacle[]): number[] | undefined {
  const middle = track.path.pointAt(track.length / 2)
  let edges: number[] | undefined
  for (const person of people) {
    const wide = person.radius ?? PERSON_RADIUS
    // a cheap circle around the whole track throws out everybody down the street
    if (distance(middle, person) > track.length / 2 + HALF_WIDTH + wide) continue
    const { s, off } = track.path.nearestTo(person)
    if (off > HALF_WIDTH + wide) continue
    ;(edges ??= []).push(s - wide)
  }
  edges?.sort((a, b) => a - b)
  return edges
}
