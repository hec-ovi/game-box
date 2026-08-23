import { CellBits } from './bits.ts'
import type { Cell } from './cells.ts'
import { type CostGrid, STEP_COUNT } from './grid.ts'
import { Reach } from './reach.ts'

/**
 * One pass over the grid answering "where can I get from here" for every cell
 * at once. The frontier stack lives as long as the fill, so repeating it costs
 * only the answer it hands back.
 */
export class FloodFill {
  readonly #grid: CostGrid
  readonly #frontier: Int32Array

  constructor(grid: CostGrid) {
    this.#grid = grid
    this.#frontier = new Int32Array(grid.size)
  }

  run(start: Cell): Reach {
    const grid = this.#grid
    const bits = new CellBits(grid.size)
    const frontier = this.#frontier

    if (grid.walkable(start.x, start.y)) {
      let top = 0
      frontier[top++] = grid.index(start.x, start.y)
      bits.add(frontier[0]!)
      while (top > 0) {
        const current = frontier[--top]!
        const cx = grid.x(current)
        const cy = grid.y(current)
        for (let dir = 0; dir < STEP_COUNT; dir++) {
          const neighbour = grid.step(cx, cy, dir)
          if (neighbour >= 0 && bits.add(neighbour)) frontier[top++] = neighbour
        }
      }
    }
    return new Reach({ x: start.x, y: start.y }, grid.width, grid.height, bits)
  }
}
