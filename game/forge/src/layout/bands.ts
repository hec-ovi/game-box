import type { Brief } from '../brief.ts'

/** Cells across a roadway: two 3 m lanes at 2 m per cell. */
export const STREET_CELLS = 3
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

/** The whole map, mountains included. */
export function gridSize(brief: Brief): Size {
  const span = (blocks: number) => MOUNTAIN_CELLS * 2 + BAND * (blocks + 1) + brief.blockCells * blocks
  return { width: span(brief.blocksX), height: span(brief.blocksY) }
}

/** Where each street band starts, across or down. */
export function bandStarts(blocks: number, blockCells: number): number[] {
  return Array.from({ length: blocks + 1 }, (_, i) => MOUNTAIN_CELLS + i * (BAND + blockCells))
}
