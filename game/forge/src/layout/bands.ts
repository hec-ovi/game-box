import { METRICS } from '@gb/world'

/** Cells across a roadway, kerb to kerb: the width `@gb/world` publishes. */
export const STREET_CELLS = METRICS.street.roadwayCells
/** Cells of sidewalk on each side of a street. */
export const SIDEWALK_CELLS = 1
/** Cells of mountain around the whole map. */
export const MOUNTAIN_CELLS = 4
/** A whole street band: sidewalk, roadway, sidewalk. */
export const BAND = SIDEWALK_CELLS + STREET_CELLS + SIDEWALK_CELLS
/** Cells from the near edge of a band to the middle of its roadway. */
export const CENTRELINE = SIDEWALK_CELLS + Math.floor(STREET_CELLS / 2)
/** Cells from the middle of a roadway to its kerb. */
export const HALF_ROADWAY = Math.floor(STREET_CELLS / 2)

export interface Cell {
  readonly x: number
  readonly y: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

/**
 * Cells from one edge of the map to the other along one axis, mountains
 * included: a street band before every block, one more after the last, and the
 * mountain ring around the lot.
 */
export function spanOf(blocks: number, blockCells: number): number {
  return MOUNTAIN_CELLS * 2 + BAND * (blocks + 1) + blockCells * blocks
}
