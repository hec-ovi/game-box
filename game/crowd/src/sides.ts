import type { CellKind, World } from '@gb/world'
import type { Cell } from './ports.ts'

/** Not a side: off the grid, or ground that is not pavement. */
const NOWHERE = -1

/**
 * Which stretch of pavement a cell belongs to. A city's pavement is not one
 * surface: every junction cuts it, so a block's ring, the strip along the
 * mountain ring and a park are each their own island, and getting from one to
 * another means stepping into the road.
 *
 * Knowing the islands is what makes a crossing meaningful: a crossing is worth
 * walking to only if it lands on the side you are trying to reach.
 */
export class Sides {
  readonly count: number
  #width: number
  #height: number
  #label: Int32Array

  private constructor(width: number, height: number, label: Int32Array, count: number) {
    this.#width = width
    this.#height = height
    this.#label = label
    this.count = count
  }

  /** One flood fill over the grid, four ways, at city build time. */
  static from(world: World, kinds: readonly CellKind[]): Sides {
    const walk = new Set<CellKind>(kinds)
    const { width, height } = world.grid
    const label = new Int32Array(width * height).fill(NOWHERE)
    const stack: number[] = []
    let count = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const at = y * width + x
        const kind = world.grid.at(x, y)
        if (label[at] !== NOWHERE || kind === undefined || !walk.has(kind)) continue
        const side = count++
        label[at] = side
        stack.push(at)
        while (stack.length > 0) {
          const here = stack.pop()!
          const hx = here % width
          const hy = (here - hx) / width
          for (let step = 0; step < 4; step++) {
            const nx = hx + (step === 0 ? 1 : step === 1 ? -1 : 0)
            const ny = hy + (step === 2 ? 1 : step === 3 ? -1 : 0)
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const next = ny * width + nx
            const there = world.grid.at(nx, ny)
            if (label[next] !== NOWHERE || there === undefined || !walk.has(there)) continue
            label[next] = side
            stack.push(next)
          }
        }
      }
    }
    return new Sides(width, height, label, count)
  }

  /** Which side of the road this cell is on, or -1 for anything that is not pavement. */
  of(cell: Cell): number {
    if (cell.x < 0 || cell.y < 0 || cell.x >= this.#width || cell.y >= this.#height) return NOWHERE
    return this.#label[cell.y * this.#width + cell.x]!
  }
}
