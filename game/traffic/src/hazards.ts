import { METRICS } from '@gb/world'
import type { Car } from './car.ts'
import type { Point } from './geometry.ts'
import type { Obstacles } from './obstacles.ts'
import { TrackIndex } from './track-index.ts'
import { Link, type Track } from './track.ts'

/** How much road somebody takes up when the port does not say. Metres. */
const PERSON_RADIUS = 0.5
/** Half a car across: what the front of the car would actually hit. */
const HALF_WIDTH = METRICS.vehicle.carWidth / 2
/** Half a car along: the gap is measured from its nose, not its middle. */
const HALF_LENGTH = METRICS.vehicle.carLength / 2
/** How far off a road the index files it: enough for a person of ordinary size. */
const FILED_WITHIN = HALF_WIDTH + 1

/**
 * The people, in terms a car understands: for every stretch of road somebody is
 * standing in, how far along it they are. Built fresh each update from the
 * `Obstacles` port, so a person stepping back onto the pavement clears the road
 * the same frame.
 *
 * The work is one lookup per person, not one per car: the roads are indexed
 * once when the city loads, and each person is matched to the two or three they
 * could be standing in. A city with nobody in the road costs nothing at all.
 */
export class Hazards {
  readonly #source: Obstacles | undefined
  readonly #index: TrackIndex | undefined
  /** Track id to the near edge of everybody in it, in metres along, sorted. */
  readonly #onTrack = new Map<string, number[]>()
  /** The tracks with somebody in them this frame, so the lists are reused rather than rebuilt. */
  readonly #live: string[] = []

  constructor(source: Obstacles | undefined, roads: Iterable<Track>) {
    this.#source = source
    this.#index = source ? new TrackIndex(roads, FILED_WITHIN) : undefined
  }

  /** Read the people once, and file each of them under the roads they are standing in. */
  refresh(focus: Point, radius: number): void {
    for (const id of this.#live) this.#onTrack.get(id)!.length = 0
    this.#live.length = 0
    const index = this.#index
    if (!this.#source || !index) return
    for (const person of this.#source.near(focus, radius)) {
      const wide = person.radius ?? PERSON_RADIUS
      const reach = HALF_WIDTH + wide
      for (const track of index.near(person, reach)) {
        const { s, off } = track.path.nearestTo(person)
        if (off > reach) continue
        this.#mark(track.id, s - wide)
      }
    }
    for (const id of this.#live) this.#onTrack.get(id)!.sort(ascending)
  }

  /**
   * Nobody in the way of a car at `at` metres along this track driving on for
   * `room` more. A new car needs it, because one cannot be dropped onto
   * somebody nor so close behind them that it could not stop, and so does a car
   * about to take a junction, which must not stop half way across one.
   */
  clearFor(track: Track, at: number, room: number): boolean {
    const edges = this.#onTrack.get(track.id)
    if (!edges || edges.length === 0) return true
    const from = at - HALF_LENGTH
    const to = at + room
    for (const edge of edges) {
      if (edge >= to) return true
      if (edge > from) return false
    }
    return true
  }

  /**
   * Metres of clear road in front of this car's nose before somebody is
   * standing in it, looking one track ahead the way the car in front is
   * looked for. Infinity when the road is clear.
   */
  gapFor(car: Car): number {
    if (this.#live.length === 0) return Number.POSITIVE_INFINITY
    const here = this.#firstAfter(car.track.id, car.s)
    if (here !== undefined) return here - car.s - HALF_LENGTH
    const next = beyond(car)
    if (!next) return Number.POSITIVE_INFINITY
    const there = this.#firstAfter(next.id, Number.NEGATIVE_INFINITY)
    return there === undefined ? Number.POSITIVE_INFINITY : car.remaining + there - HALF_LENGTH
  }

  #mark(trackId: string, edge: number): void {
    let edges = this.#onTrack.get(trackId)
    if (!edges) {
      edges = []
      this.#onTrack.set(trackId, edges)
    }
    if (edges.length === 0) this.#live.push(trackId)
    edges.push(edge)
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

function ascending(a: number, b: number): number {
  return a - b
}
