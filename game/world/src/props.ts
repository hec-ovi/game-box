import { METRICS } from './metrics.ts'
import type { FurnitureProp } from './model/vocabulary.ts'

/**
 * Every piece of furniture, at the size it is drawn: the floor it claims and
 * the height a body meets it at. One table, read by the planner that keeps
 * pieces apart and by the renderer that builds them, so the two cannot drift.
 */

/** One room cell, in metres. A footprint is a whole number of these. */
export const PROP_CELL = 0.1

/** Cells across the front of a piece, then cells from its front to its back. */
export type PropCells = readonly [number, number]

/**
 * Which surface of a piece a body meets. `work` is the level plate a body
 * leans or works on: a counter top, a desk, a hob. `rest` is the one it sits
 * or lies on: a seat, a mattress.
 */
export type PropContactKind = 'work' | 'rest'

export interface PropContact {
  readonly kind: PropContactKind
  /** Metres off the floor the surface lands at, exactly. */
  readonly height: number
}

export interface PropSpec {
  readonly cells: PropCells
  /** The surface a body meets, for a piece somebody uses. */
  readonly contact?: PropContact
  /** Metres tall, for a piece nobody touches. */
  readonly height?: number
  /**
   * A second working surface on the far side, for a piece worked from both
   * sides: the shelf the staff work from behind a bar counter.
   */
  readonly staffContact?: number
  /** True for a piece that stands on a counter top rather than on the floor. */
  readonly onSurface?: boolean
  /** Whether a body has to walk around it. A rug and a till stop nobody. */
  readonly blocks: boolean
}

/** A footprint in metres. */
export interface PropFootprint {
  readonly width: number
  readonly depth: number
}

const {
  barCounterHeight,
  serviceCounterHeight,
  worktopHeight,
  tableHeight,
  stoolHeight,
  seatHeight,
  mattressHeight,
} = METRICS.furniture

const work = (cells: PropCells, height: number): PropSpec => ({ cells, contact: { kind: 'work', height }, blocks: true })
const rest = (cells: PropCells, height: number): PropSpec => ({ cells, contact: { kind: 'rest', height }, blocks: true })
const tall = (cells: PropCells, height: number): PropSpec => ({ cells, height, blocks: true })
const onTop = (cells: PropCells, height: number): PropSpec => ({ cells, height, onSurface: true, blocks: false })

export const PROP_SPECS: Record<FurnitureProp, PropSpec> = {
  'bar-counter': { ...work([15, 6], barCounterHeight), staffContact: serviceCounterHeight },
  'bar-stool': rest([4, 4], stoolHeight),
  table: work([10, 10], tableHeight),
  chair: rest([5, 5], seatHeight),
  sofa: rest([20, 9], seatHeight),
  /** 21 cells deep: a body lying down is 1.92 m boots to crown, and the headboard takes 10 cm behind it. */
  bed: rest([12, 21], mattressHeight),
  desk: work([14, 7], tableHeight),
  'office-chair': rest([6, 6], seatHeight),
  shelf: tall([10, 4], 1.8),
  cabinet: tall([9, 5], 1.2),
  wardrobe: tall([12, 6], 2),
  fridge: tall([7, 6], 1.8),
  stove: work([6, 6], worktopHeight),
  sink: work([6, 6], worktopHeight),
  counter: work([15, 6], serviceCounterHeight),
  register: onTop([4, 4], 0.3),
  'display-case': tall([12, 6], 1.5),
  'crate-stack': tall([9, 9], 1.2),
  plant: { cells: [5, 5], blocks: true },
  lamp: tall([4, 4], 1.5),
  rug: { cells: [20, 15], height: 0.02, blocks: false },
  tv: tall([10, 3], 0.65),
  'coffee-machine': onTop([6, 5], 0.45),
  jukebox: tall([8, 5], 1.5),
}

/** The floor a piece claims, in metres. */
export function footprintOf(prop: FurnitureProp): PropFootprint {
  const [across, deep] = PROP_SPECS[prop].cells
  return { width: across * PROP_CELL, depth: deep * PROP_CELL }
}
