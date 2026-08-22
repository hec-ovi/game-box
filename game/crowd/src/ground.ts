import { cellCentre, type CellKind, type World } from '@gb/world'
import type { Cell, Point } from './ports.ts'

/**
 * The city floor, read in metres. Cell coordinates and world metres convert
 * through the world's own cell size, never a constant, so a city built at a
 * different scale still puts feet in the right place.
 */
export class Ground {
  readonly cellSize: number
  #world: World
  #raised: ReadonlySet<CellKind>
  #kerbHeight: number

  constructor(world: World, raised: readonly CellKind[], kerbHeight: number) {
    this.#world = world
    this.cellSize = world.cellSize
    this.#raised = new Set(raised)
    this.#kerbHeight = kerbHeight
  }

  cellAt(x: number, z: number): Cell {
    return { x: Math.floor(x / this.cellSize), y: Math.floor(z / this.cellSize) }
  }

  centreOf(cell: Cell): Point {
    return cellCentre(cell.x, cell.y, this.cellSize)
  }

  /**
   * True where a walker is off the roadway: the pavement and park kinds it was
   * built with. Straight to the grid rather than through `cellAt`, because
   * every walker asks this of every step it takes.
   */
  pavement(x: number, z: number): boolean {
    const kind = this.#world.grid.at(Math.floor(x / this.cellSize), Math.floor(z / this.cellSize))
    return kind !== undefined && this.#raised.has(kind)
  }

  /** Pavement and parks sit a kerb above the roadway; everything else is at zero. */
  heightAt(x: number, z: number): number {
    return this.pavement(x, z) ? this.#kerbHeight : 0
  }
}
