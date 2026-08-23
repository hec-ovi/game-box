import type { Furniture, FurnitureProp } from '@gb/world'
import { boxAt, gapToPiece, type Box, type Extent, type Vec } from './geometry.ts'

export interface PropSpec extends Extent {
  /** Metres across the front of the piece. */
  readonly w: number
  /** Metres from its front to its back. */
  readonly d: number
  /** Whether a person has to walk around it. Seats and rugs do not stop anyone. */
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
  'bar-stool': floor(0.45, 0.45, false),
  table: floor(1.6, 0.9, true),
  chair: floor(0.5, 0.5, false),
  sofa: floor(2, 0.85, true),
  bed: floor(1.2, 2, true),
  desk: floor(1.4, 0.7, true),
  'office-chair': floor(0.6, 0.6, false),
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
