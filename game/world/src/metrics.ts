/**
 * Real-world proportions, in metres. Everything the generator places is sized
 * from these, so a street feels like a street when you stand in it.
 * One world unit is one metre.
 */
export const METRICS = {
  /** Side of one grid cell. Streets, sidewalks and plots are whole cells. */
  cellSize: 2,

  street: {
    /** Cells across the roadway, kerb to kerb: 3 cells, 6 m, both directions. */
    roadwayCells: 3,
    /** Going: read `roadwayCells`. */
    laneCells: 2,
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

  /**
   * Where a body meets a piece of furniture: the surface it sits, sleeps or
   * works on. The art is built to these heights and the clips reach for them,
   * so a seat is one number rather than one per box.
   */
  furniture: {
    barCounterHeight: 1.1,
    /** A counter you are served over. */
    serviceCounterHeight: 1.0,
    /** A kitchen or workshop run you stand at. */
    worktopHeight: 0.9,
    tableHeight: 0.75,
    stoolHeight: 0.75,
    /** Where a sitting body's hips land. */
    seatHeight: 0.45,
    mattressHeight: 0.5,
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
  },
} as const

export type Metrics = typeof METRICS

/** Cell coordinates to world metres, at the centre of the cell. */
export function cellCentre(x: number, y: number, cellSize: number = METRICS.cellSize): { x: number; z: number } {
  return { x: (x + 0.5) * cellSize, z: (y + 0.5) * cellSize }
}
