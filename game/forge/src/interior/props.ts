import type { Furniture, FurnitureProp } from '@gb/world'
import { boxAt, type Box } from './geometry.ts'

export interface PropSpec {
  /** Metres across the front of the piece. */
  readonly w: number
  /** Metres from its front to its back. */
  readonly d: number
  /** Whether a person has to walk around it. Seats and rugs do not stop anyone. */
  readonly blocks: boolean
}

/**
 * How much floor each prop takes. These sizes are what the planner keeps apart,
 * so they have to match what the renderer puts in the room.
 */
export const PROP_SPECS: Record<FurnitureProp, PropSpec> = {
  'bar-counter': { w: 1.5, d: 0.6, blocks: true },
  'bar-stool': { w: 0.45, d: 0.45, blocks: false },
  table: { w: 1, d: 1, blocks: true },
  chair: { w: 0.5, d: 0.5, blocks: false },
  sofa: { w: 2, d: 0.85, blocks: true },
  bed: { w: 1.2, d: 2, blocks: true },
  desk: { w: 1.4, d: 0.7, blocks: true },
  'office-chair': { w: 0.6, d: 0.6, blocks: false },
  shelf: { w: 1, d: 0.4, blocks: true },
  cabinet: { w: 0.9, d: 0.45, blocks: true },
  wardrobe: { w: 1.2, d: 0.6, blocks: true },
  fridge: { w: 0.7, d: 0.7, blocks: true },
  stove: { w: 0.7, d: 0.65, blocks: true },
  sink: { w: 0.6, d: 0.55, blocks: true },
  counter: { w: 1.5, d: 0.6, blocks: true },
  register: { w: 0.4, d: 0.35, blocks: true },
  'display-case': { w: 1.2, d: 0.6, blocks: true },
  'crate-stack': { w: 0.9, d: 0.9, blocks: true },
  plant: { w: 0.5, d: 0.5, blocks: true },
  lamp: { w: 0.35, d: 0.35, blocks: true },
  rug: { w: 2, d: 1.5, blocks: false },
  tv: { w: 1, d: 0.25, blocks: true },
  'coffee-machine': { w: 0.6, d: 0.5, blocks: true },
  jukebox: { w: 0.8, d: 0.5, blocks: true },
}

/** The floor a placed piece covers. */
export function footprintOf(piece: Pick<Furniture, 'prop' | 'pos' | 'rot'>): Box {
  return boxAt(piece.pos, PROP_SPECS[piece.prop], piece.rot)
}

export function specOf(prop: FurnitureProp): PropSpec {
  return PROP_SPECS[prop]
}
