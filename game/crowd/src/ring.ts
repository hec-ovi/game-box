import type { Rng } from '@gb/kit'
import type { Cell, Point } from './ports.ts'

/** Cells per bucket side. Eight cells is sixteen metres, about one spawn ring step. */
const BUCKET = 8

/** One thing standing on a cell, placed in metres so a pick measures nothing twice. */
interface Entry<T> {
  readonly x: number
  readonly z: number
  readonly item: T
}

/**
 * Things on the city grid, bucketed so that "one of them between twenty and
 * sixty metres from here" is a handful of bucket lookups instead of a sweep of
 * the whole city. The pavement is one of these over cells; the doors in town
 * are another over plots.
 */
export class Ring<T> {
  #cellSize: number
  #bucketsX: number
  #bucketsY: number
  #buckets = new Map<number, Entry<T>[]>()
  /** Reused by every pick, so choosing somewhere allocates nothing. */
  #scratch: T[] = []

  constructor(cellSize: number, width: number, height: number) {
    this.#cellSize = cellSize
    this.#bucketsX = Math.ceil(width / BUCKET)
    this.#bucketsY = Math.ceil(height / BUCKET)
  }

  add(cell: Cell, item: T): void {
    const key = Math.floor(cell.y / BUCKET) * this.#bucketsX + Math.floor(cell.x / BUCKET)
    let bucket = this.#buckets.get(key)
    if (!bucket) this.#buckets.set(key, (bucket = []))
    bucket.push({ x: (cell.x + 0.5) * this.#cellSize, z: (cell.y + 0.5) * this.#cellSize, item })
  }

  /**
   * One of them in the band between two distances of a point in metres, or
   * undefined when the band holds none. One draw from `rng`, whatever the
   * number of candidates, so a walker's stream does not depend on city size.
   */
  pick(centre: Point, minMetres: number, maxMetres: number, rng: Rng): T | undefined {
    const candidates = this.#scratch
    candidates.length = 0
    const minSq = minMetres * minMetres
    const maxSq = maxMetres * maxMetres
    const reach = Math.ceil(maxMetres / this.#cellSize)
    const cx = Math.floor(centre.x / this.#cellSize)
    const cy = Math.floor(centre.z / this.#cellSize)

    const from = Math.max(0, Math.floor((cy - reach) / BUCKET))
    const to = Math.min(this.#bucketsY - 1, Math.floor((cy + reach) / BUCKET))
    const left = Math.max(0, Math.floor((cx - reach) / BUCKET))
    const right = Math.min(this.#bucketsX - 1, Math.floor((cx + reach) / BUCKET))

    for (let by = from; by <= to; by++) {
      for (let bx = left; bx <= right; bx++) {
        const bucket = this.#buckets.get(by * this.#bucketsX + bx)
        if (!bucket) continue
        for (const entry of bucket) {
          const dx = entry.x - centre.x
          const dz = entry.z - centre.z
          const d = dx * dx + dz * dz
          if (d >= minSq && d <= maxSq) candidates.push(entry.item)
        }
      }
    }
    if (candidates.length === 0) return undefined
    return candidates[rng.int(0, candidates.length)]
  }
}
