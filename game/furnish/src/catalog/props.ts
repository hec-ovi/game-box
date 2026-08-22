/**
 * What each piece of furniture the generator can place is made of, and the box
 * it has to end up in.
 *
 * `w` and `d` are the floor the room planner keeps clear for a piece, so the
 * art is scaled to fill that footprint and never more: a chair that overhangs
 * its own square ends up inside the table. `h` is given where the height is
 * part of what the thing is (a counter you lean on, a table you eat at, a stool
 * that reaches the bar); left out, the art keeps its own proportions and stands
 * as tall as it comes.
 *
 * The kit is medieval, the vocabulary is a modern town, so some entries are
 * stand-ins and say so. Nothing here is a guess at a shape: every prop is a
 * model of the right silhouette, scaled, never a barrel pretending to be a bed.
 */
import { METRICS, type FurnitureProp } from '@gb/world'
import type { PieceId } from './pieces.ts'

/** One source model in a prop, and where it sits in the piece's own units. */
export interface PropPart {
  readonly piece: PieceId
  /** Offset in the source model's units. Stacking one cupboard on another is the only use so far. */
  readonly at?: readonly [number, number, number]
}

export interface PropArt {
  readonly parts: readonly PropPart[]
  /** Metres across the front. */
  readonly w: number
  /** Metres front to back. */
  readonly d: number
  /** Metres tall, when the height is load-bearing. */
  readonly h?: number
}

const { barCounterHeight, tableHeight, stoolHeight } = METRICS.furniture

/** A cupboard on a cupboard: the only thing in either kit that stands as tall as a wardrobe. */
const TALL_CUPBOARD: readonly PropPart[] = [{ piece: 'cabinet_small' }, { piece: 'cabinet_small', at: [0, 1, 0] }]

/** Neither kit has a bookcase: three of the kit's shelf boards, one above the other, are the shelving. */
const SHELF_RUN: readonly PropPart[] = [
  { piece: 'shelf_B_small' },
  { piece: 'shelf_B_small', at: [0, 0.55, 0] },
  { piece: 'shelf_B_small', at: [0, 1.1, 0] },
]

export const PROP_ART: Record<FurnitureProp, PropArt> = {
  // the bar is a sideboard: a solid front to the room, a top at leaning height
  'bar-counter': { parts: [{ piece: 'cabinet_medium' }], w: 1.5, h: barCounterHeight, d: 0.6 },
  'bar-stool': { parts: [{ piece: 'chair_stool_wood' }], w: 0.45, h: stoolHeight, d: 0.45 },
  table: { parts: [{ piece: 'table_small' }], w: 1, h: tableHeight, d: 1 },
  chair: { parts: [{ piece: 'chair_A_wood' }], w: 0.5, h: 0.9, d: 0.5 },
  sofa: { parts: [{ piece: 'couch' }], w: 2, d: 0.85 },
  bed: { parts: [{ piece: 'bed_single_A' }], w: 1.2, d: 2 },
  desk: { parts: [{ piece: 'cabinet_medium' }], w: 1.4, h: tableHeight, d: 0.7 },
  'office-chair': { parts: [{ piece: 'chair_B' }], w: 0.6, h: 0.95, d: 0.6 },
  shelf: { parts: SHELF_RUN, w: 1, h: 1.8, d: 0.4 },
  cabinet: { parts: [{ piece: 'cabinet_small' }], w: 0.9, h: 1.2, d: 0.45 },
  wardrobe: { parts: TALL_CUPBOARD, w: 1.2, h: 2, d: 0.6 },
  // no fridge in a medieval kit: a larder cupboard stands where the kitchen wants one
  fridge: { parts: TALL_CUPBOARD, w: 0.7, h: 1.8, d: 0.7 },
  // and no stove: a dressed stone block is the range
  stove: { parts: [{ piece: 'floor_foundation_allsides' }], w: 0.7, h: 0.9, d: 0.65 },
  // and no sink: a water barrel
  sink: { parts: [{ piece: 'barrel_small' }], w: 0.6, h: 0.9, d: 0.55 },
  counter: { parts: [{ piece: 'cabinet_medium' }], w: 1.5, h: 0.95, d: 0.6 },
  // the till is a small strongbox
  register: { parts: [{ piece: 'chest' }], w: 0.4, h: 0.3, d: 0.35 },
  'display-case': { parts: [{ piece: 'shelf_B_small_decorated' }], w: 1.2, h: 1.1, d: 0.6 },
  'crate-stack': { parts: [{ piece: 'crates_stacked' }], w: 0.9, h: 1.2, d: 0.9 },
  plant: { parts: [{ piece: 'cactus_medium_A' }], w: 0.5, d: 0.5 },
  lamp: { parts: [{ piece: 'lamp_standing' }], w: 0.35, h: 1.5, d: 0.35 },
  rug: { parts: [{ piece: 'rug_rectangle_A' }], w: 2, d: 1.5 },
  // a framed panel where the screen goes
  tv: { parts: [{ piece: 'pictureframe_small_B' }], w: 1, h: 0.65, d: 0.25 },
  // a small keg on the cafe counter
  'coffee-machine': { parts: [{ piece: 'keg' }], w: 0.6, h: 0.6, d: 0.5 },
  // a carved cabinet in the corner where the music would be
  jukebox: { parts: [{ piece: 'cabinet_small_decorated' }], w: 0.8, h: 1.5, d: 0.5 },
}

/** Every source piece some prop is made of. */
export function piecesUsed(): PieceId[] {
  const used = new Set<PieceId>()
  for (const art of Object.values(PROP_ART)) for (const part of art.parts) used.add(part.piece)
  return [...used]
}
