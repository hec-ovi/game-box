import type { Point } from './geometry.ts'
import type { Track } from './track.ts'

/** Grid cell side, metres: about a junction across, so a lane touches a handful. */
const CELL = 8
/** Spreads a cell pair into one number key. Unique for any city, and cheaper than a string. */
const ROW = 4194304

/**
 * Where every piece of road is, so somebody standing in the street can be
 * matched to the two or three lanes they could be in rather than to every lane
 * a car is driving. The roads never move, so this is built once and only read
 * afterwards.
 *
 * A track is filed under every cell its path comes within `margin` of, so
 * anybody within `margin` of a track is standing in one of that track's cells:
 * looking up their own cell is enough. Somebody wider than that widens the
 * block that is looked at instead.
 */
export class TrackIndex {
  readonly #margin: number
  readonly #tracks: Track[] = []
  readonly #cells = new Map<number, number[]>()
  /** Which tracks this lookup has already answered with, by visit number. */
  readonly #seen: Int32Array
  #visit = 0
  /** Handed back by `near`, refilled each call, never kept by anyone. */
  readonly #found: Track[] = []

  constructor(tracks: Iterable<Track>, margin: number) {
    this.#margin = margin
    for (const track of tracks) {
      const at = this.#tracks.length
      this.#tracks.push(track)
      this.#file(track, at)
    }
    this.#seen = new Int32Array(this.#tracks.length)
  }

  get size(): number {
    return this.#tracks.length
  }

  /**
   * Every track whose road could come within `reach` metres of this point. A
   * few extra are normal, none within reach is ever missed, and the array is
   * the same one every call.
   */
  near(p: Point, reach: number): readonly Track[] {
    const found = this.#found
    found.length = 0
    const spread = Math.ceil(Math.max(0, reach - this.#margin) / CELL)
    const cx = cellOf(p.x)
    const cz = cellOf(p.z)
    const visit = ++this.#visit
    for (let x = cx - spread; x <= cx + spread; x++) {
      for (let z = cz - spread; z <= cz + spread; z++) {
        const list = this.#cells.get(x * ROW + z)
        if (!list) continue
        for (const at of list) {
          if (this.#seen[at] === visit) continue
          this.#seen[at] = visit
          found.push(this.#tracks[at]!)
        }
      }
    }
    return found
  }

  /** File a track under every cell one of its pieces reaches, margin included. */
  #file(track: Track, at: number): void {
    const points = track.path.points
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!
      const b = points[i + 1]!
      const x0 = cellOf(Math.min(a.x, b.x) - this.#margin)
      const x1 = cellOf(Math.max(a.x, b.x) + this.#margin)
      const z0 = cellOf(Math.min(a.z, b.z) - this.#margin)
      const z1 = cellOf(Math.max(a.z, b.z) + this.#margin)
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const key = x * ROW + z
          const list = this.#cells.get(key)
          if (!list) this.#cells.set(key, [at])
          else if (!list.includes(at)) list.push(at)
        }
      }
    }
  }
}

function cellOf(metres: number): number {
  return Math.floor(metres / CELL)
}
