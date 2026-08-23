/**
 * The room matrix. A room is a grid of 10 cm cells and a piece of furniture is
 * a rectangle of them, so where a thing goes is a whole number of cells and two
 * pieces can never half-overlap.
 *
 * Every footprint in this box is written in cells and converted here, so the
 * only place a furniture size becomes a float is one multiplication.
 */

/** One room cell, in metres. */
export const CELL = 0.1

/** A footprint: cells across the front, then cells front to back. */
export type Cells = readonly [number, number]

export interface Footprint {
  /** Metres across the front. */
  readonly width: number
  /** Metres front to back. */
  readonly depth: number
}

export function metresOf(cells: Cells): Footprint {
  return { width: cells[0] * CELL, depth: cells[1] * CELL }
}
