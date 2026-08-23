import type { World } from '@gb/world'
import type { CellBits } from './bits.ts'
import type { Cell } from './cells.ts'

/**
 * Everywhere one start can walk to, answered in one pass. Ask it about a cell,
 * a doorstep or a whole city's worth of plots as often as you like: it is a
 * lookup, never another search.
 */
export class Reach {
  /** Where the walk started. */
  readonly from: Cell
  /** How many cells are reachable, the start included. */
  readonly cells: number
  /** How much memory this answer occupies. */
  readonly byteLength: number
  readonly #width: number
  readonly #height: number
  readonly #bits: CellBits

  constructor(from: Cell, width: number, height: number, bits: CellBits) {
    this.from = from
    this.#width = width
    this.#height = height
    this.#bits = bits
    this.cells = bits.count
    this.byteLength = bits.byteLength
  }

  /** Can the start walk to this cell? False outside the grid. */
  reaches(cell: Cell): boolean {
    const { x, y } = cell
    if (x < 0 || y < 0 || x >= this.#width || y >= this.#height) return false
    return this.#bits.has(y * this.#width + x)
  }

  /** Can the start walk to this building's doorstep? False when the id is unknown. */
  reachesPlot(world: World, plotId: string): boolean {
    const plot = world.plot(plotId)
    return plot ? this.reaches(plot.entrance.cell) : false
  }

  /** Every building the start cannot walk to, in the world's own plot order. */
  unreachablePlots(world: World): string[] {
    return world
      .plots()
      .filter((plot) => !this.reaches(plot.entrance.cell))
      .map((plot) => plot.id)
  }
}
