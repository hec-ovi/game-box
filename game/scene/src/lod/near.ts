import type { Plot } from '@gb/world'

/**
 * How far from the player a building is drawn in detail and a room is kept
 * built, in metres. Signs and lit windows are read from the pavement and
 * across a street, not from the next district; past this the shell carries
 * the walls and the roof.
 */
export const DETAIL_RADIUS = 64

/**
 * How far from the player a building wears the shell its dressing drew, in
 * metres: four times the detail, which is about four blocks of a forged city.
 * Past it the building is its massing, so the far half of a town costs its
 * skyline rather than its facades. `CityOptions.shell` moves it for a machine
 * that can pay for more.
 */
export const SHELL_RADIUS = 256

/** A cell of the city grid: where the player is, to the cell. */
export interface Cell {
  readonly x: number
  readonly y: number
}

/** The cell a point on the ground is in. */
export function cellOf(x: number, z: number, cellSize: number): Cell {
  return { x: Math.floor(x / cellSize), y: Math.floor(z / cellSize) }
}

export function sameCell(a: Cell | undefined, b: Cell): boolean {
  return a !== undefined && a.x === b.x && a.y === b.y
}

/**
 * Whether a plot's footprint comes within `radius` metres of the middle of
 * that cell. A pure function of the cell, so what is near is the same on every
 * machine and every run for the same place on the ground.
 */
export function isNear(plot: Plot, cell: Cell, radius: number, cellSize: number): boolean {
  const px = (cell.x + 0.5) * cellSize
  const pz = (cell.y + 0.5) * cellSize
  const dx = Math.max(plot.rect.x * cellSize - px, 0, px - (plot.rect.x + plot.rect.w) * cellSize)
  const dz = Math.max(plot.rect.y * cellSize - pz, 0, pz - (plot.rect.y + plot.rect.h) * cellSize)
  return dx * dx + dz * dz <= radius * radius
}
