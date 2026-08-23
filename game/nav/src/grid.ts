import type { CellKind, World } from '@gb/world'
import { WALK_COST } from './costs.ts'

const DIAGONAL = Math.SQRT2

/** The eight ways out of a cell, flat so a search loop allocates nothing. */
export const STEP_COUNT = 8
const STEP_DX = Int8Array.from([1, -1, 0, 0, 1, 1, -1, -1])
const STEP_DY = Int8Array.from([0, 0, 1, -1, 1, -1, 1, -1])
export const STEP_STRIDE = Float64Array.from([1, 1, 1, 1, DIAGONAL, DIAGONAL, DIAGONAL, DIAGONAL])

/**
 * The city grid priced for walking: one cost per cell, and the single rule for
 * what counts as a legal step. Every search in this box asks this and only
 * this, so a route and a flood fill can never disagree about what is passable.
 */
export class CostGrid {
  readonly width: number
  readonly height: number
  readonly size: number
  /** The cheapest ground anywhere on this grid: what a heuristic may assume per step. */
  readonly minCost: number
  readonly #cost: Float32Array

  private constructor(width: number, height: number, cost: Float32Array, minCost: number) {
    this.width = width
    this.height = height
    this.size = width * height
    this.#cost = cost
    this.minCost = minCost
  }

  static from(world: World, costs: Partial<Record<CellKind, number>> = {}): CostGrid {
    const table = { ...WALK_COST, ...costs }
    let minCost = Number.POSITIVE_INFINITY
    for (const price of Object.values(table)) {
      if (Number.isFinite(price) && price < minCost) minCost = price
    }
    if (!(minCost > 0)) minCost = 0

    const { width, height } = world.grid
    const cost = new Float32Array(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const kind = world.grid.at(x, y)
        cost[y * width + x] = kind ? table[kind] : Number.POSITIVE_INFINITY
      }
    }
    return new CostGrid(width, height, cost, minCost)
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  index(x: number, y: number): number {
    return this.inside(x, y) ? y * this.width + x : -1
  }

  x(index: number): number {
    return index % this.width
  }

  y(index: number): number {
    return (index - (index % this.width)) / this.width
  }

  /** What a step onto this cell costs. Infinite means you cannot stand there. */
  costAt(index: number): number {
    return this.#cost[index]!
  }

  walkable(x: number, y: number): boolean {
    const index = this.index(x, y)
    return index >= 0 && Number.isFinite(this.#cost[index]!)
  }

  /**
   * The cell you reach by taking step `dir` out of (x, y), or -1 when you may
   * not: off the grid, blocked, or a diagonal squeezing between two corners.
   */
  step(x: number, y: number, dir: number): number {
    const dx = STEP_DX[dir]!
    const dy = STEP_DY[dir]!
    const nx = x + dx
    const ny = y + dy
    if (!this.inside(nx, ny)) return -1
    const neighbour = ny * this.width + nx
    if (!Number.isFinite(this.#cost[neighbour]!)) return -1
    if (dx !== 0 && dy !== 0) {
      if (!Number.isFinite(this.#cost[y * this.width + nx]!)) return -1
      if (!Number.isFinite(this.#cost[ny * this.width + x]!)) return -1
    }
    return neighbour
  }
}
