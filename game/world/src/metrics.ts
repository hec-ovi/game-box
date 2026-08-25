import { ROAD_WIDTHS } from './roads.ts'

/**
 * Real-world proportions, in metres. Everything the generator places is sized
 * from these, so a street feels like a street when you stand in it.
 * One world unit is one metre.
 */
export const METRICS = {
  /** Side of one grid cell. Streets, sidewalks and plots are whole cells. */
  cellSize: 2,

  /** Every class of road at its own width, in whole cells. */
  road: ROAD_WIDTHS,

  street: {
    /** How far a pavement stands above the roadway it is kerbed against. */
    curbHeight: 0.15,
    /** The street class's roadway, the same number as `road.street.roadwayCells`. */
    roadwayCells: ROAD_WIDTHS.street.roadwayCells,
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
   * How far a body reaches in each stance, measured off the shipped clips
   * (`assets/dist/anims.glb`) skinned onto all twelve dressed characters with
   * the root on the floor. A surface a body works at has to sit between the
   * underside of its palms and its wrists, or the hands float over it.
   * `@gb/cast`'s pose tests are where the measurement is taken; a reauthored
   * clip moves these numbers and the furniture heights below with them.
   */
  reach: {
    /** On the feet at a surface: `serve`, `work-bench`, `cook`. */
    standing: { palm: 0.972, wrist: 1.041 },
    /** Sat at a desk, leaning in: `work-desk`. */
    seated: { palm: 0.72, wrist: 0.787 },
    /** Sat down with the soles on the floor: the underside a pad has to hold. */
    seatContact: 0.423,
    /** Sat on a stool with the feet on its rail, the clip carrying its own height: the underside, and where the soles rest. */
    stoolContact: 0.723,
    stoolSoles: 0.38,
    /** How far a pad may be above a body's underside before it floats on it. */
    padGive: 0.03,
  },

  /**
   * Where a body meets a piece of furniture: the surface it sits, sleeps or
   * works on. The art is built to these heights, so a seat is one number rather
   * than one per box. Every one a body reaches for or sits on is held to
   * `reach` above.
   */
  furniture: {
    /**
     * The customer's rail of a bar, where a drink stands and the lean clip
     * rests its forearms: the same standing reach as any other counter.
     */
    barCounterHeight: 1.0,
    /** A counter you are served over, and the shelf the staff work from behind a bar. */
    serviceCounterHeight: 1.0,
    /**
     * A kitchen or workshop run you stand at. The same number as a service
     * counter because one standing clip serves both: it is a run a body works
     * at, and there is no lower standing pose on this rig.
     */
    worktopHeight: 1.0,
    tableHeight: 0.75,
    /** A bar stool's pad: where the stool clips put the hips, with the soles on a rail 0.37 m under it. */
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
