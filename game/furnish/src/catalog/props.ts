/**
 * What each piece of furniture the generator can place is made of, the box it
 * has to end up in, and where the surface a body meets it lands.
 *
 * `w` and `d` are the floor the room planner keeps clear for a piece, so the
 * art is scaled to fill that footprint and never more: a chair that overhangs
 * its own square ends up inside the table.
 *
 * Then a piece is sized up one of three ways, and only one of them:
 *
 * - `contact`, when somebody sits, lies, leans or works at it. The surface
 *   their body meets is measured off the model and landed on that height, so a
 *   bartender's forearms are on the counter and a diner's weight is on the
 *   seat. This is the number that matters and the one the tests measure.
 * - `h`, when nobody touches it but the height is part of what it is: a
 *   wardrobe is two metres, a shelf run is 1.8.
 * - neither, and the model keeps its own proportions.
 */
import { METRICS, type FurnitureProp } from '@gb/world'
import type { PieceId } from './pieces.ts'

/** One source model in a prop, and where it sits in the piece's own units. */
export interface PropPart {
  readonly piece: PieceId
  /** Offset in the source model's units. Stacking boxes is what this is for. */
  readonly at?: readonly [number, number, number]
}

/**
 * Which surface of a piece a body meets.
 *
 * `work` is the highest level plate wide enough to lean or work on: a counter
 * top, a desk, a hob, the worktop beside a sink. `rest` is the widest one: a
 * seat, a mattress. Both are read off the geometry, never off the bounding
 * box, because the top of a chair is its backrest and the top of a bed is its
 * headboard.
 */
export type ContactKind = 'work' | 'rest'

export interface Contact {
  readonly kind: ContactKind
  /** Metres off the floor the surface has to land at. */
  readonly height: number
}

export interface PropArt {
  readonly parts: readonly PropPart[]
  /** Metres across the front. */
  readonly w: number
  /** Metres front to back. */
  readonly d: number
  /** Metres tall, for a piece nobody touches whose height still matters. */
  readonly h?: number
  /** The surface a body meets, for a piece somebody uses. */
  readonly contact?: Contact
}

const { barCounterHeight, tableHeight, stoolHeight } = METRICS.furniture

/**
 * Heights `METRICS.furniture` does not carry yet, measured against the clips
 * `@gb/cast` plays on the anchors that use them. Every one of them belongs in
 * `@gb/world` beside the three that are there; until it takes them, this is
 * the only place they are written.
 */
/** A seated body's hips land 9 cm over the seat, and the sitting clip puts them at 0.54. */
const SEAT_HEIGHT = 0.45
/** A retail counter you are served over, and a workshop bench you work at. */
const COUNTER_HEIGHT = 1
/** A kitchen worktop: the hob, and the run beside the sink. */
const WORKTOP_HEIGHT = 0.9
/** The top of a made single bed. */
const MATTRESS_HEIGHT = 0.5

const seat = (height = SEAT_HEIGHT): Contact => ({ kind: 'rest', height })
const worktop = (height: number): Contact => ({ kind: 'work', height })

/** Two boxes deep, two across and two high: a stack of stock in a back room. */
const BOX_STACK: readonly PropPart[] = [
  { piece: 'cardboardBoxClosed', at: [-0.11, 0, -0.11] },
  { piece: 'cardboardBoxClosed', at: [0.11, 0, -0.11] },
  { piece: 'cardboardBoxClosed', at: [-0.11, 0, 0.11] },
  { piece: 'cardboardBoxClosed', at: [0.11, 0, 0.11] },
  { piece: 'cardboardBoxClosed', at: [-0.11, 0.28, 0] },
  { piece: 'cardboardBoxClosed', at: [0.11, 0.28, 0] },
]

/** A pair of floor-standing speakers: where the music comes from. */
const SPEAKER_PAIR: readonly PropPart[] = [
  { piece: 'speaker', at: [-0.09, 0, 0] },
  { piece: 'speaker', at: [0.09, 0, 0] },
]

export const PROP_ART: Record<FurnitureProp, PropArt> = {
  'bar-counter': { parts: [{ piece: 'kitchenBar' }], w: 1.5, d: 0.6, contact: worktop(barCounterHeight) },
  'bar-stool': { parts: [{ piece: 'stoolBar' }], w: 0.45, d: 0.45, contact: seat(stoolHeight) },
  table: { parts: [{ piece: 'tableCoffeeSquare' }], w: 1, d: 1, contact: worktop(tableHeight) },
  chair: { parts: [{ piece: 'chairModernCushion' }], w: 0.5, d: 0.5, contact: seat() },
  sofa: { parts: [{ piece: 'loungeSofa' }], w: 2, d: 0.85, contact: seat() },
  bed: { parts: [{ piece: 'bedSingle' }], w: 1.2, d: 2, contact: seat(MATTRESS_HEIGHT) },
  desk: { parts: [{ piece: 'desk' }], w: 1.4, d: 0.7, contact: worktop(tableHeight) },
  'office-chair': { parts: [{ piece: 'chairDesk' }], w: 0.6, d: 0.6, contact: seat() },
  shelf: { parts: [{ piece: 'bookcaseOpen' }], w: 1, h: 1.8, d: 0.4 },
  cabinet: { parts: [{ piece: 'bookcaseClosedWide' }], w: 0.9, h: 1.2, d: 0.45 },
  wardrobe: { parts: [{ piece: 'bookcaseClosedDoors' }], w: 1.2, h: 2, d: 0.6 },
  fridge: { parts: [{ piece: 'kitchenFridgeLarge' }], w: 0.7, h: 1.8, d: 0.7 },
  stove: { parts: [{ piece: 'kitchenStove' }], w: 0.7, d: 0.65, contact: worktop(WORKTOP_HEIGHT) },
  sink: { parts: [{ piece: 'kitchenSink' }], w: 0.6, d: 0.55, contact: worktop(WORKTOP_HEIGHT) },
  counter: { parts: [{ piece: 'kitchenCabinet' }], w: 1.5, d: 0.6, contact: worktop(COUNTER_HEIGHT) },
  register: { parts: [{ piece: 'cash-register' }], w: 0.4, h: 0.3, d: 0.35 },
  'display-case': { parts: [{ piece: 'freezers-standing' }], w: 1.2, h: 1.5, d: 0.6 },
  'crate-stack': { parts: BOX_STACK, w: 0.9, h: 1.2, d: 0.9 },
  plant: { parts: [{ piece: 'pottedPlant' }], w: 0.5, d: 0.5 },
  lamp: { parts: [{ piece: 'lampSquareFloor' }], w: 0.35, h: 1.5, d: 0.35 },
  rug: { parts: [{ piece: 'rugRectangle' }], w: 2, d: 1.5 },
  tv: { parts: [{ piece: 'televisionModern' }], w: 1, h: 0.65, d: 0.25 },
  'coffee-machine': { parts: [{ piece: 'kitchenCoffeeMachine' }], w: 0.6, h: 0.6, d: 0.5 },
  jukebox: { parts: SPEAKER_PAIR, w: 0.8, h: 1.5, d: 0.5 },
}

/** Every source piece some prop is made of. */
export function piecesUsed(): PieceId[] {
  const used = new Set<PieceId>()
  for (const art of Object.values(PROP_ART)) for (const part of art.parts) used.add(part.piece)
  return [...used]
}
