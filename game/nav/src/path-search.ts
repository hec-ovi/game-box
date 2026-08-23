import type { Cell } from './cells.ts'
import { type CostGrid, STEP_COUNT, STEP_STRIDE } from './grid.ts'
import { MinHeap } from './heap.ts'

const MAX_RUN = 0x7fffffff

/**
 * A* over the cost grid, with its working memory allocated once and stamped per
 * search rather than cleared. Clearing three city-sized arrays would cost more
 * than the short searches the crowd makes every frame; a stamp makes a stale
 * entry recognisable in the same read that uses it.
 */
export class PathSearch {
  readonly #grid: CostGrid
  readonly #gScore: Float64Array
  readonly #cameFrom: Int32Array
  readonly #stamp: Int32Array
  readonly #open = new MinHeap()
  #run = 0

  constructor(grid: CostGrid) {
    this.#grid = grid
    this.#gScore = new Float64Array(grid.size)
    this.#cameFrom = new Int32Array(grid.size)
    this.#stamp = new Int32Array(grid.size)
  }

  /** Searches from one cell index to another. True when a route exists; `route` then reads it out. */
  run(start: number, goal: number): boolean {
    const grid = this.#grid
    const gScore = this.#gScore
    const cameFrom = this.#cameFrom
    const stamp = this.#stamp
    const open = this.#open
    const run = this.#nextRun()
    const gx = grid.x(goal)
    const gy = grid.y(goal)
    const scale = grid.minCost

    open.clear()
    gScore[start] = 0
    cameFrom[start] = -1
    stamp[start] = run
    open.push(start, heuristic(grid.x(start), grid.y(start), gx, gy, scale))

    for (;;) {
      const current = open.pop()
      if (current < 0) return false
      if (current === goal) return true

      const cx = grid.x(current)
      const cy = grid.y(current)
      const currentScore = gScore[current]!

      for (let dir = 0; dir < STEP_COUNT; dir++) {
        const neighbour = grid.step(cx, cy, dir)
        if (neighbour < 0) continue
        const tentative = currentScore + grid.costAt(neighbour) * STEP_STRIDE[dir]!
        if (stamp[neighbour] === run && tentative >= gScore[neighbour]!) continue
        stamp[neighbour] = run
        gScore[neighbour] = tentative
        cameFrom[neighbour] = current
        const nx = grid.x(neighbour)
        const ny = grid.y(neighbour)
        open.push(neighbour, tentative + heuristic(nx, ny, gx, gy, scale))
      }
    }
  }

  /** The route the last successful `run` found, start first. */
  route(goal: number): Cell[] {
    const grid = this.#grid
    const cells: Cell[] = []
    let current = goal
    while (current !== -1) {
      cells.push({ x: grid.x(current), y: grid.y(current) })
      current = this.#cameFrom[current]!
    }
    return cells.reverse()
  }

  /** A fresh stamp, wrapping back to a cleared grid before an Int32 can overflow. */
  #nextRun(): number {
    if (this.#run >= MAX_RUN) {
      this.#stamp.fill(0)
      this.#run = 0
    }
    return ++this.#run
  }
}

/** Octile distance priced at the cheapest ground on the grid, so it never overestimates. */
function heuristic(x: number, y: number, gx: number, gy: number, scale: number): number {
  const dx = Math.abs(x - gx)
  const dy = Math.abs(y - gy)
  return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * scale
}
