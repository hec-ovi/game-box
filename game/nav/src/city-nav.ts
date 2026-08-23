import type { CellKind, World } from '@gb/world'
import type { Cell, Point } from './cells.ts'
import { FloodFill } from './flood.ts'
import { CostGrid } from './grid.ts'
import { PathSearch } from './path-search.ts'
import type { Reach } from './reach.ts'
import { waypoints } from './waypoints.ts'

/**
 * Walking routes across a city, straight off the grid it was generated on.
 * No navmesh to bake: the grid already says what is ground and what is wall,
 * which is the point of generating the city as a matrix in the first place.
 *
 * One `CityNav` owns its search memory. Hold it for as long as you hold the
 * world and every route after the first is free of allocation.
 */
export class CityNav {
  readonly width: number
  readonly height: number
  readonly #grid: CostGrid
  readonly #search: PathSearch
  readonly #flood: FloodFill
  readonly #cellSize: number

  private constructor(grid: CostGrid, cellSize: number) {
    this.width = grid.width
    this.height = grid.height
    this.#grid = grid
    this.#cellSize = cellSize
    this.#search = new PathSearch(grid)
    this.#flood = new FloodFill(grid)
  }

  static from(world: World, costs: Partial<Record<CellKind, number>> = {}): CityNav {
    return new CityNav(CostGrid.from(world, costs), world.cellSize)
  }

  walkable(cell: Cell): boolean {
    return this.#grid.walkable(cell.x, cell.y)
  }

  /** The cheapest walk from one cell to another, or undefined when there is none. */
  path(from: Cell, to: Cell): Cell[] | undefined {
    const start = this.#walkableIndex(from)
    const goal = this.#walkableIndex(to)
    if (start < 0 || goal < 0) return undefined
    if (start === goal) return [{ x: from.x, y: from.y }]
    return this.#search.run(start, goal) ? this.#search.route(goal) : undefined
  }

  /** Is there any walk at all? Same search as `path`, without building the route. */
  reachable(from: Cell, to: Cell): boolean {
    const start = this.#walkableIndex(from)
    const goal = this.#walkableIndex(to)
    if (start < 0 || goal < 0) return false
    if (start === goal) return true
    return this.#search.run(start, goal)
  }

  /**
   * Everywhere you can walk from one cell, in a single pass over the grid.
   * One of these answers a whole city's plots; asking `reachable` per plot
   * runs one search per plot instead.
   */
  reachableFrom(start: Cell): Reach {
    return this.#flood.run(start)
  }

  /** Walk to a building's doorstep. */
  pathToDoor(world: World, from: Cell, plotId: string): Cell[] | undefined {
    const plot = world.plot(plotId)
    if (!plot) return undefined
    return this.path(from, plot.entrance.cell)
  }

  /**
   * The same route with the straight stretches collapsed, in metres: what an
   * NPC actually walks, instead of one waypoint per cell.
   */
  waypoints(path: readonly Cell[]): Point[] {
    return waypoints(path, this.#cellSize)
  }

  #walkableIndex(cell: Cell): number {
    return this.#grid.walkable(cell.x, cell.y) ? this.#grid.index(cell.x, cell.y) : -1
  }
}
