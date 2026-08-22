import { cellCentre } from '@gb/world'
import type { Cell, CrowdNav, Point } from '../../src/index.ts'

/**
 * Navigation with no city in it: it hands out one straight run of cells, so a
 * test can put a walker on a leg it chose instead of one the city chose. Every
 * cell is walkable, so nothing here can push a walker into a wall.
 */
abstract class RunNav implements CrowdNav {
  /** Where the last route handed out ends, in metres. */
  destination: Point | undefined
  protected readonly cellSize: number
  protected readonly legs: number
  /** With a row given, only that row is walkable, which makes a pavement exactly one cell wide. */
  readonly lane: number | undefined

  constructor(cellSize: number, legs: number, lane?: number) {
    this.cellSize = cellSize
    this.legs = legs
    this.lane = lane
  }

  walkable(cell: Cell): boolean {
    return this.lane === undefined || cell.y === this.lane
  }

  abstract path(from: Cell): Cell[]

  /** Corners only, the way `@gb/nav` gives them: a straight run is one leg, not one waypoint per cell. */
  waypoints(path: readonly Cell[]): Point[] {
    const corners = path.filter((cell, i) => {
      const before = path[i - 1]
      const after = path[i + 1]
      if (!before || !after) return true
      return cell.x - before.x !== after.x - cell.x || cell.y - before.y !== after.y - cell.y
    })
    const points = corners.map((cell) => cellCentre(cell.x, cell.y, this.cellSize))
    this.destination = points[points.length - 1]
    return points
  }

  protected run(from: Cell, stepX: number, stepY: number): Cell[] {
    const cells: Cell[] = [from]
    for (let leg = 1; leg <= this.legs; leg++) cells.push({ x: from.x + stepX * leg, y: from.y + stepY * leg })
    return cells
  }
}

/** Everybody walks the same compass direction, however far they have to go. */
export class StraightNav extends RunNav {
  #way: Cell

  constructor(cellSize: number, legs: number, way: Cell, lane?: number) {
    super(cellSize, legs, lane)
    this.#way = way
  }

  path(from: Cell): Cell[] {
    return this.run(from, this.#way.x, this.#way.y)
  }
}

/** Everybody walks the row they are on towards one column, and carries on past it. */
export class MeetNav extends RunNav {
  #column: number

  constructor(cellSize: number, legs: number, column: number) {
    super(cellSize, legs)
    this.#column = column
  }

  path(from: Cell): Cell[] {
    return this.run(from, Math.sign(this.#column - from.x) || 1, 0)
  }
}
