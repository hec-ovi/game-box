import type { Rng } from '@gb/kit'
import type { CellKind, World } from '@gb/world'
import type { Cell, Point } from './ports.ts'

/** Cells per bucket side. Eight cells is sixteen metres, about one spawn ring step. */
const BUCKET = 8

/**
 * Every cell a pedestrian may stand on, bucketed so that "somewhere walkable
 * between twenty and sixty metres from here" is a handful of bucket lookups
 * instead of a sweep of the whole city.
 */
export class Pavement {
  #cellSize: number
  #bucketsX: number
  #bucketsY: number
  #buckets: Map<number, Cell[]>
  /** Reused by every pick, so choosing a destination allocates nothing. */
  #scratch: Cell[] = []

  private constructor(cellSize: number, bucketsX: number, bucketsY: number, buckets: Map<number, Cell[]>) {
    this.#cellSize = cellSize
    this.#bucketsX = bucketsX
    this.#bucketsY = bucketsY
    this.#buckets = buckets
  }

  static from(world: World, kinds: readonly CellKind[]): Pavement {
    const wanted = new Set(kinds)
    const { width, height } = world.grid
    const bucketsX = Math.ceil(width / BUCKET)
    const buckets = new Map<number, Cell[]>()
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const kind = world.grid.at(x, y)
        if (kind === undefined || !wanted.has(kind)) continue
        const key = Math.floor(y / BUCKET) * bucketsX + Math.floor(x / BUCKET)
        let bucket = buckets.get(key)
        if (!bucket) buckets.set(key, (bucket = []))
        bucket.push({ x, y })
      }
    }
    return new Pavement(world.cellSize, bucketsX, Math.ceil(height / BUCKET), buckets)
  }

  /**
   * A walkable cell in the ring between two distances of a point in metres,
   * or undefined when the ring holds none. One draw from `rng`, whatever the
   * number of candidates, so a walker's stream does not depend on city size.
   */
  pick(centre: Point, minMetres: number, maxMetres: number, rng: Rng): Cell | undefined {
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
        for (const cell of bucket) {
          const dx = (cell.x + 0.5) * this.#cellSize - centre.x
          const dz = (cell.y + 0.5) * this.#cellSize - centre.z
          const d = dx * dx + dz * dz
          if (d >= minSq && d <= maxSq) candidates.push(cell)
        }
      }
    }
    if (candidates.length === 0) return undefined
    return candidates[rng.int(0, candidates.length)]
  }
}
