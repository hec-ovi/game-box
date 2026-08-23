import { cellCentre, type CellKind, type World } from '@gb/world'
import type { Cell, CrowdGround, Point } from './ports.ts'

/**
 * The city floor, read in metres. Cell coordinates and world metres convert
 * through the world's own cell size, never a constant, so a city built at a
 * different scale still puts feet in the right place.
 *
 * The grid runs out at the edge of town. Past it the ground is whatever the
 * game's ground source says it is, and with none given there is nothing out
 * there: no height, and nowhere to stand.
 */
export class Ground {
  readonly cellSize: number
  #world: World
  #raised: ReadonlySet<CellKind>
  #kerbHeight: number
  #beyond: CrowdGround | undefined

  constructor(world: World, raised: readonly CellKind[], kerbHeight: number, beyond?: CrowdGround) {
    this.#world = world
    this.cellSize = world.cellSize
    this.#raised = new Set(raised)
    this.#kerbHeight = kerbHeight
    this.#beyond = beyond
  }

  /** True when this point is on the city grid at all. */
  holds(x: number, z: number): boolean {
    return this.#world.grid.at(Math.floor(x / this.cellSize), Math.floor(z / this.cellSize)) !== undefined
  }

  /** True when the ground outside the city takes feet here. Nothing is out there without a ground source. */
  outside(x: number, z: number): boolean {
    return this.#beyond?.walkableAt(x, z) ?? false
  }

  cellAt(x: number, z: number): Cell {
    return { x: Math.floor(x / this.cellSize), y: Math.floor(z / this.cellSize) }
  }

  /** True on the roadway: the one ground a pedestrian crosses rather than walks along. */
  roadway(cell: Cell): boolean {
    return this.#world.grid.at(cell.x, cell.y) === 'street'
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

  /**
   * Where feet go: the ground the game gave us, and a kerb on top of it on
   * pavement and park cells. With no ground source the city is flat at zero,
   * which is what it is, and only the kerb lifts anybody.
   */
  heightAt(x: number, z: number): number {
    return (this.#beyond?.heightAt(x, z) ?? 0) + (this.pavement(x, z) ? this.#kerbHeight : 0)
  }
}
