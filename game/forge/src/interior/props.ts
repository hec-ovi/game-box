import { METRICS, type Furniture, type FurnitureProp } from '@gb/world'
import { boxAt, gapToPiece, type Box, type Extent, type Vec } from './geometry.ts'

export interface PropSpec extends Extent {
  /** Metres across the front of the piece. */
  readonly w: number
  /** Metres from its front to its back. */
  readonly d: number
  /** Whether a person has to walk around it. A rug does not stop anyone; a chair does. */
  readonly blocks: boolean
  /**
   * What the piece stands on. A till and a coffee machine sit on a counter top,
   * and a placed piece only ever has a floor position, so the planner leaves
   * them out rather than standing them on the floor.
   */
  readonly stands: 'floor' | 'counter'
}

const floor = (w: number, d: number, blocks: boolean): PropSpec => ({ w, d, blocks, stands: 'floor' })
const onCounter = (w: number, d: number): PropSpec => ({ w, d, blocks: false, stands: 'counter' })

/**
 * How much floor each prop takes. These sizes are what the planner keeps apart,
 * so they have to match what the renderer puts in the room.
 */
export const PROP_SPECS: Record<FurnitureProp, PropSpec> = {
  'bar-counter': floor(1.5, 0.6, true),
  'bar-stool': floor(0.45, 0.45, true),
  table: floor(1, 1, true),
  chair: floor(0.5, 0.5, true),
  sofa: floor(2, 0.85, true),
  bed: floor(1.2, 2, true),
  desk: floor(1.4, 0.7, true),
  'office-chair': floor(0.6, 0.6, true),
  shelf: floor(1, 0.4, true),
  cabinet: floor(0.9, 0.45, true),
  wardrobe: floor(1.2, 0.6, true),
  fridge: floor(0.7, 0.7, true),
  stove: floor(0.7, 0.65, true),
  sink: floor(0.6, 0.55, true),
  counter: floor(1.5, 0.6, true),
  register: onCounter(0.4, 0.35),
  'display-case': floor(1.2, 0.6, true),
  'crate-stack': floor(0.9, 0.9, true),
  plant: floor(0.5, 0.5, true),
  lamp: floor(0.35, 0.35, true),
  rug: floor(2, 1.5, false),
  tv: floor(1, 0.25, true),
  'coffee-machine': onCounter(0.6, 0.5),
  jukebox: floor(0.8, 0.5, true),
}

/**
 * The part of a seat a body has to agree with: where its back stands, and how
 * far the surface you sit on runs from front to back. Both are metres from the
 * piece's own centre along its depth, positive towards its back, and both were
 * measured off the triangles `@gb/furnish` draws in both interior languages: a
 * back is the geometry that rises at least 0.2 m above the seat over the width
 * a torso covers, a pad is the level plate at the contact height.
 */
export interface SeatSpec {
  /** Front face of the back rest. A stool leaves it out: there is nothing to lean on. */
  readonly back?: number
  /** Front and back edge of the surface a body sits on. */
  readonly pad: readonly [number, number]
}

/**
 * Every piece a body sits or lies on, and nothing else. A bar stool is not one
 * of them: the seated clip has its soles on the floor and its underside at
 * 0.423 m, which is a chair, not a 0.75 m stool, so a stool is a piece a body
 * walks round until `@gb/cast` has a pose for a raised seat.
 */
export const SEAT_SPECS = {
  chair: { back: 0.194, pad: [-0.22, 0.22] },
  'office-chair': { back: 0.235, pad: [-0.232, 0.232] },
  sofa: { back: 0.37, pad: [-0.402, 0.242] },
  bed: { back: 0.95, pad: [-0.97, 0.867] },
} as const satisfies Partial<Record<FurnitureProp, SeatSpec>>

export type SeatProp = keyof typeof SEAT_SPECS

/** What sitting on this piece means, or nothing for a piece nobody sits on. */
export function seatSpecOf(prop: FurnitureProp): SeatSpec | undefined {
  return (SEAT_SPECS as Partial<Record<FurnitureProp, SeatSpec>>)[prop]
}

/**
 * How high the top of a piece is, for the handful of pieces something else
 * stands on. The same numbers `@gb/furnish` draws those tops at, so a till put
 * on a counter here lands on the counter there without anybody measuring.
 */
const TOPS: Partial<Record<FurnitureProp, number>> = {
  counter: METRICS.furniture.serviceCounterHeight,
  'bar-counter': METRICS.furniture.barCounterHeight,
}

/** The height of a piece's top, or nothing for one nothing stands on. */
export function topOf(prop: FurnitureProp): number | undefined {
  return TOPS[prop]
}

type Placement = Pick<Furniture, 'prop' | 'pos' | 'rot'>

/** The floor a placed piece covers. */
export function footprintOf(piece: Placement): Box {
  return boxAt(piece.pos, PROP_SPECS[piece.prop], piece.rot)
}

/** Metres from a point to the nearest face of a placed piece; zero inside it. */
export function gapTo(piece: Placement, point: Vec): number {
  return gapToPiece(point, piece.pos, PROP_SPECS[piece.prop], piece.rot)
}

export function specOf(prop: FurnitureProp): PropSpec {
  return PROP_SPECS[prop]
}
