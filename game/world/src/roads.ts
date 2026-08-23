import { ROAD_KINDS, type RoadKind } from './model/vocabulary.ts'

/**
 * How wide one class of road is, in whole grid cells. A city is laid in cells,
 * so a width is a count of them rather than a number of metres: multiply by
 * `cellSize` for the metres.
 */
export interface RoadWidth {
  /** Cells across the roadway, kerb to kerb. Always odd, see below. */
  readonly roadwayCells: number
  /** Cells of pavement along each side of it. */
  readonly pavementCells: number
  /** Lanes of traffic the roadway holds, counting both directions. */
  readonly lanes: number
}

/**
 * Every class of road, at its own width.
 *
 * A roadway is always an **odd** number of cells, because its centreline is
 * then a line of cell centres, and that is where the road graph's nodes sit. An
 * even roadway would put every junction half a cell off the middle of the road
 * and every car half a cell off its lane.
 *
 * A street is the ordinary road: two lanes and room to stop at the kerb. An
 * avenue is the spine a district hangs off: four lanes, two each way. The road
 * out of the valley is the widest of the three, because everything leaving town
 * goes down it and nothing fronts onto it.
 */
export const ROAD_WIDTHS: Record<RoadKind, RoadWidth> = {
  street: { roadwayCells: 5, pavementCells: 2, lanes: 2 },
  avenue: { roadwayCells: 7, pavementCells: 2, lanes: 4 },
  exit: { roadwayCells: 9, pavementCells: 2, lanes: 4 },
}

/**
 * The widest roadway any class lays: how far a pedestrian may have to walk to
 * get from one kerb to the other, and what anything looking for a crossing has
 * to be willing to span.
 */
export const WIDEST_ROADWAY_CELLS: number = Math.max(...ROAD_KINDS.map((kind) => ROAD_WIDTHS[kind].roadwayCells))
