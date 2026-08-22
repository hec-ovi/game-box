/**
 * Real-world proportions, in metres. Everything the generator places is sized
 * from these, so a street feels like a street when you stand in it.
 * One world unit is one metre.
 */
export const METRICS = {
  /** Side of one grid cell. Streets, sidewalks and plots are whole cells. */
  cellSize: 2,

  street: {
    /** Cells across for a normal two-way street (one cell per lane plus edges). */
    laneCells: 2,
    sidewalkCells: 1,
    curbHeight: 0.15,
  },

  building: {
    storeyHeight: 3.2,
    groundFloorHeight: 4,
    doorHeight: 2.1,
    doorWidth: 1.0,
    /** Interior wall thickness. */
    wallThickness: 0.2,
  },

  furniture: {
    barCounterHeight: 1.1,
    tableHeight: 0.75,
    stoolHeight: 0.75,
    chairSeatHeight: 0.45,
  },

  player: {
    eyeHeight: 1.7,
    radius: 0.35,
    height: 1.8,
    walkSpeed: 1.4,
    runSpeed: 4.5,
    /** How close you stand to a door before it offers to let you in. */
    interactRange: 2.5,
  },

  vehicle: {
    carLength: 4.5,
    carWidth: 1.8,
    parkingLength: 5.5,
  },
} as const

export type Metrics = typeof METRICS

/** Cell coordinates to world metres, at the centre of the cell. */
export function cellCentre(x: number, y: number, cellSize: number = METRICS.cellSize): { x: number; z: number } {
  return { x: (x + 0.5) * cellSize, z: (y + 0.5) * cellSize }
}
