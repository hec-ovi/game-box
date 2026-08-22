import { METRICS } from '@gb/world'
import { holds, inset, overlaps, type Box, type Vec } from './geometry.ts'

/** Side of a grid cell in metres. Fine enough to see a gap a person can squeeze through. */
const CELL = 0.1

/** How close a point has to be to open floor to count as standing on it. */
export const FOOTING = 0.2

/** How far someone reaches from open floor onto a seat or a bed. */
export const REACH = 0.8

const RADIUS = METRICS.player.radius

interface Solid {
  readonly box: Box
  readonly blocks: boolean
}

/**
 * The free floor of one room: what is already on it, which spots are kept clear,
 * and whether a person can still walk between the places that matter.
 *
 * Walking is tested on a grid of the room with every blocking piece grown by the
 * player's radius, so a gap only counts when a body actually fits through it.
 */
export class Floor {
  readonly bounds: Box
  readonly #solids: Solid[] = []
  readonly #reserved: Box[] = []
  #labels: Int32Array | undefined
  #cols = 0
  #rows = 0

  constructor(rect: Box, wallClear: number) {
    this.bounds = inset(rect, wallClear)
  }

  /** Room for this box: inside the walls, off everything placed, out of the kept-clear spots. */
  fits(box: Box, gap = 0.05): boolean {
    return holds(this.bounds, box) && this.clear(box, gap)
  }

  /** Nothing placed or kept clear stands in this box. */
  clear(box: Box, gap = 0.05): boolean {
    for (const zone of this.#reserved) if (overlaps(zone, box)) return false
    return this.open(box, gap)
  }

  /** No furniture in this box. A doorway counts as open floor: that is what it is for. */
  open(box: Box, gap = 0.05): boolean {
    for (const solid of this.#solids) if (overlaps(solid.box, box, gap)) return false
    return true
  }

  add(box: Box, blocks: boolean): void {
    this.#solids.push({ box, blocks })
    if (blocks) this.#labels = undefined
  }

  /** Takes back the last piece added, for a placement that turned out to seal something off. */
  undo(): void {
    const dropped = this.#solids.pop()
    if (dropped?.blocks) this.#labels = undefined
  }

  /** Floor that has to stay empty: doorways, and the working side of a counter. */
  reserve(box: Box): void {
    this.#reserved.push(box)
  }

  /** Every one of these spots can still be walked between. */
  connected(points: readonly Vec[]): boolean {
    return this.#shared(points) !== undefined
  }

  /** Open floor within reach of a spot that you can walk to from all of `points`. */
  footing(point: Vec, reach: number, points: readonly Vec[]): Vec | undefined {
    const shared = this.#shared(points)
    if (!shared) return undefined
    let best: Vec | undefined
    let closest = Infinity
    for (const cell of this.#near(point, reach)) {
      if (!shared.has(cell.label)) continue
      const away = (cell.x - point.x) ** 2 + (cell.y - point.y) ** 2
      if (away < closest) {
        closest = away
        best = { x: cell.x, y: cell.y }
      }
    }
    return best
  }

  /** The stretches of floor every one of these spots stands on. */
  #shared(points: readonly Vec[]): Set<number> | undefined {
    this.#grid()
    let labels: Set<number> | undefined
    for (const point of points) {
      const here = new Set(this.#near(point, FOOTING).map((cell) => cell.label))
      if (!labels) labels = here
      else for (const label of [...labels]) if (!here.has(label)) labels.delete(label)
      if (labels.size === 0) return undefined
    }
    if (labels) return labels
    const all = new Set<number>()
    for (const label of this.#grid()) if (label > 0) all.add(label)
    return all
  }

  #near(point: Vec, reach: number): Array<{ x: number; y: number; label: number }> {
    const grid = this.#grid()
    const found: Array<{ x: number; y: number; label: number }> = []
    const span = Math.ceil(reach / CELL)
    const cx = Math.floor((point.x - this.bounds.x) / CELL)
    const cy = Math.floor((point.y - this.bounds.y) / CELL)
    for (let y = cy - span; y <= cy + span; y++) {
      for (let x = cx - span; x <= cx + span; x++) {
        if (x < 0 || y < 0 || x >= this.#cols || y >= this.#rows) continue
        const label = grid[y * this.#cols + x]!
        if (label < 0) continue
        const px = this.bounds.x + (x + 0.5) * CELL
        const py = this.bounds.y + (y + 0.5) * CELL
        if ((px - point.x) ** 2 + (py - point.y) ** 2 <= reach * reach) found.push({ x: px, y: py, label })
      }
    }
    return found
  }

  #grid(): Int32Array {
    if (this.#labels) return this.#labels
    this.#cols = Math.max(1, Math.floor(this.bounds.w / CELL))
    this.#rows = Math.max(1, Math.floor(this.bounds.h / CELL))
    const walk = inset(this.bounds, RADIUS)
    const blocked = this.#solids.filter((solid) => solid.blocks).map((solid) => inset(solid.box, -RADIUS))
    const labels = new Int32Array(this.#cols * this.#rows).fill(-1)

    for (let y = 0; y < this.#rows; y++) {
      for (let x = 0; x < this.#cols; x++) {
        const px = this.bounds.x + (x + 0.5) * CELL
        const py = this.bounds.y + (y + 0.5) * CELL
        const outside = px < walk.x || py < walk.y || px > walk.x + walk.w || py > walk.y + walk.h
        if (outside) continue
        if (blocked.some((box) => px > box.x && px < box.x + box.w && py > box.y && py < box.y + box.h)) continue
        labels[y * this.#cols + x] = 0
      }
    }

    let next = 1
    const stack: number[] = []
    for (let start = 0; start < labels.length; start++) {
      if (labels[start] !== 0) continue
      const label = next++
      labels[start] = label
      stack.push(start)
      while (stack.length) {
        const cell = stack.pop()!
        const x = cell % this.#cols
        const y = (cell - x) / this.#cols
        const around = [
          x > 0 ? cell - 1 : -1,
          x < this.#cols - 1 ? cell + 1 : -1,
          y > 0 ? cell - this.#cols : -1,
          y < this.#rows - 1 ? cell + this.#cols : -1,
        ]
        for (const side of around) {
          if (side < 0 || labels[side] !== 0) continue
          labels[side] = label
          stack.push(side)
        }
      }
    }

    this.#labels = labels
    return labels
  }
}
