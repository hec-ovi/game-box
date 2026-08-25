import { METRICS } from '@gb/world'
import type { Car } from './car.ts'
import { clearanceFrom, offsetBy, Path, type Point } from './geometry.ts'
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
 * Somebody standing in one piece of road: where, and how far along it their
 * near edge is. Somebody beside a bend, where a swinging corner can reach them
 * but the lane itself does not, has no edge: only the footprint check sees them.
 */
class Standing {
  edge = 0
  x = 0
  z = 0
  wide = PERSON_RADIUS
}

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
  /** Metres a car's corners swing out past a bend, by track id. Nothing on a straight. */
  readonly #overhang = new Map<string, number>()
  /** Track id to everybody in it, nearest their near edge first. */
  readonly #onTrack = new Map<string, Standing[]>()
  /** The tracks with somebody in them this frame, so the lists are reused rather than rebuilt. */
  readonly #live: string[] = []
  /** Records reused frame to frame, so pricing the people allocates nothing once warm. */
  readonly #pool: Standing[] = []
  #used = 0
  #widestOverhang = 0

  constructor(source: Obstacles | undefined, roads: readonly Track[]) {
    this.#source = source
    if (!source) return
    for (const track of roads) {
      const over = cornerOverhang(track.path)
      if (over > 0) this.#overhang.set(track.id, over)
      this.#widestOverhang = Math.max(this.#widestOverhang, over)
    }
    this.#index = new TrackIndex(roads, FILED_WITHIN + this.#widestOverhang)
  }

  /** Read the people once, and file each of them under the roads they are standing in. */
  refresh(focus: Point, radius: number): void {
    for (const id of this.#live) this.#onTrack.get(id)!.length = 0
    this.#live.length = 0
    this.#used = 0
    const index = this.#index
    if (!this.#source || !index) return
    for (const person of this.#source.near(focus, radius)) {
      const wide = person.radius ?? PERSON_RADIUS
      const inLane = HALF_WIDTH + wide
      for (const track of index.near(person, inLane + this.#widestOverhang)) {
        const swing = this.#overhang.get(track.id) ?? 0
        if (!track.path.near(person, inLane + swing)) continue
        const { s, off } = track.path.nearestTo(person)
        if (off <= inLane) this.#mark(track.id, s - wide, person, wide)
        else if (off <= inLane + swing) this.#mark(track.id, Number.POSITIVE_INFINITY, person, wide)
      }
    }
    for (const id of this.#live) this.#onTrack.get(id)!.sort(byEdge)
  }

  /**
   * Nobody in the way of a car at `at` metres along this track driving on for
   * `room` more. A new car needs it, because one cannot be dropped onto
   * somebody nor so close behind them that it could not stop, and so does a car
   * about to take a junction, which must not stop half way across one.
   */
  clearFor(track: Track, at: number, room: number): boolean {
    const people = this.#onTrack.get(track.id)
    if (!people || people.length === 0) return true
    const from = at - HALF_LENGTH
    const to = at + room
    for (const { edge } of people) {
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

  /**
   * Whether this car, moved to `at` metres along its track, would have any part
   * of itself within `keep` metres of somebody standing in this piece of road
   * or the next: nose, flank or tail. The gap ahead keeps the nose off people
   * in the lane; this is what keeps the corners of a car swinging into a turn
   * off whoever is standing beside the bend.
   */
  touches(car: Car, at: number, keep: number): boolean {
    if (this.#live.length === 0) return false
    const next = beyond(car)
    const here = this.#onTrack.get(car.track.id)
    const there = next ? this.#onTrack.get(next.id) : undefined
    if (!here?.length && !there?.length) return false
    const centre = car.track.path.pointAt(at)
    const dir = car.track.path.directionAt(at)
    const onto = (one: Standing) => clearanceFrom(centre, dir, HALF_LENGTH, HALF_WIDTH, one) < one.wide + keep
    return Boolean(here?.some(onto) || there?.some(onto))
  }

  #mark(trackId: string, edge: number, at: Point, wide: number): void {
    let people = this.#onTrack.get(trackId)
    if (!people) {
      people = []
      this.#onTrack.set(trackId, people)
    }
    if (people.length === 0) this.#live.push(trackId)
    const one = this.#pool[this.#used] ?? (this.#pool[this.#used] = new Standing())
    this.#used++
    one.edge = edge
    one.x = at.x
    one.z = at.z
    one.wide = wide
    people.push(one)
  }

  #firstAfter(trackId: string, s: number): number | undefined {
    const people = this.#onTrack.get(trackId)
    if (!people) return undefined
    for (const { edge } of people) if (edge > s) return edge
    return undefined
  }
}

/** The piece of road this car drives onto next, if it has chosen one. */
function beyond(car: Car): Track | undefined {
  return car.track instanceof Link ? car.track.to : car.next
}

/**
 * How far the corners of a car stick out past a path as it follows it: nothing
 * on a straight, and on a bend the rigid car cuts the curve, so its tail and
 * outer nose swing wide of the line its middle drives. Somebody that far off a
 * bend is within reach of a car on it. The line is measured with the straight
 * road carried on past each end, which is where the rest of the car is when it
 * enters or leaves a bend shorter than itself.
 */
function cornerOverhang(path: Path): number {
  if (path.points.length < 3) return 0
  const first = path.points[0]!
  const last = path.points[path.points.length - 1]!
  const line = new Path([
    offsetBy(first, path.directionAt(0), -HALF_LENGTH),
    ...path.points,
    offsetBy(last, path.directionAt(path.length), HALF_LENGTH),
  ])
  let over = 0
  for (let s = 0; s <= path.length; s += 0.5) {
    const centre = path.pointAt(s)
    const dir = path.directionAt(s)
    for (const along of [HALF_LENGTH, -HALF_LENGTH]) {
      for (const across of [HALF_WIDTH, -HALF_WIDTH]) {
        const corner = { x: centre.x + dir.x * along - dir.z * across, z: centre.z + dir.z * along + dir.x * across }
        over = Math.max(over, line.nearestTo(corner).off - HALF_WIDTH)
      }
    }
  }
  return over
}

function byEdge(a: Standing, b: Standing): number {
  return a.edge - b.edge
}
