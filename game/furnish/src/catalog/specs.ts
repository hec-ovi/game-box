/**
 * Every piece of furniture the generator can place: the cells of floor it
 * claims, and the height a body meets it at.
 *
 * This is the table `@gb/forge` places from and this box builds to, so the two
 * cannot drift. A footprint is a whole number of 10 cm room cells, never a
 * float, because the planner claims cells.
 *
 * A piece is sized up one of two ways, and only one of them:
 *
 * - `contact`, when somebody sits, lies, leans or works at it. The geometry is
 *   built so that surface lands on that number exactly. It is not measured off
 *   a model and nudged: the slab is drawn with its top at the height, which is
 *   why a seat can never be 7 cm low again.
 * - `height`, when nobody touches it but the height is part of what it is: a
 *   wardrobe is two metres, a shelf run is 1.8.
 */
import { METRICS, type FurnitureProp } from '@gb/world'
import { metresOf, type Cells, type Footprint } from './cells.ts'

/**
 * Which surface of a piece a body meets.
 *
 * `work` is the highest level plate wide enough to lean or work on: a counter
 * top, a desk, a hob, the worktop beside a sink. `rest` is the widest one: a
 * seat, a mattress.
 */
export type ContactKind = 'work' | 'rest'

export interface Contact {
  readonly kind: ContactKind
  /** Metres off the floor the surface lands at, exactly. */
  readonly height: number
}

export interface PropSpec {
  /** The floor it claims, in 10 cm cells: across the front, then front to back. */
  readonly cells: Cells
  /** The surface a body meets, for a piece somebody uses. */
  readonly contact?: Contact
  /** Metres tall, for a piece nobody touches. */
  readonly height?: number
  /**
   * A second working surface on the far side, for a piece worked from both
   * sides. The bar counter's staff shelf: the customer's drink stands on the
   * raised rail, the bartender's forearms rest on this.
   */
  readonly staffContact?: number
  /** True for a piece that belongs on a worktop rather than on the floor. */
  readonly onSurface?: boolean
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

const rest = (height: number): Contact => ({ kind: 'rest', height })
const work = (height: number): Contact => ({ kind: 'work', height })

export const PROP_SPECS: Record<FurnitureProp, PropSpec> = {
  'bar-counter': { cells: [15, 6], contact: work(barCounterHeight), staffContact: serviceCounterHeight },
  'bar-stool': { cells: [4, 4], contact: rest(stoolHeight) },
  table: { cells: [10, 10], contact: work(tableHeight) },
  chair: { cells: [5, 5], contact: rest(seatHeight) },
  sofa: { cells: [20, 9], contact: rest(seatHeight) },
  bed: { cells: [12, 20], contact: rest(mattressHeight) },
  desk: { cells: [14, 7], contact: work(tableHeight) },
  'office-chair': { cells: [6, 6], contact: rest(seatHeight) },
  shelf: { cells: [10, 4], height: 1.8 },
  cabinet: { cells: [9, 5], height: 1.2 },
  wardrobe: { cells: [12, 6], height: 2 },
  fridge: { cells: [7, 6], height: 1.8 },
  stove: { cells: [6, 6], contact: work(worktopHeight) },
  sink: { cells: [6, 6], contact: work(worktopHeight) },
  counter: { cells: [15, 6], contact: work(serviceCounterHeight) },
  register: { cells: [4, 4], height: 0.3, onSurface: true },
  'display-case': { cells: [12, 6], height: 1.5 },
  'crate-stack': { cells: [9, 9], height: 1.2 },
  plant: { cells: [5, 5] },
  lamp: { cells: [4, 4], height: 1.5 },
  rug: { cells: [20, 15], height: 0.02 },
  tv: { cells: [10, 3], height: 0.65 },
  'coffee-machine': { cells: [6, 5], height: 0.45, onSurface: true },
  jukebox: { cells: [8, 5], height: 1.5 },
}

/** The floor a prop claims, in metres. */
export function footprintOf(prop: FurnitureProp): Footprint {
  return metresOf(PROP_SPECS[prop].cells)
}
