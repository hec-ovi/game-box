import { METRICS } from '@gb/world'
import { MODULE } from '../catalog/pieces.ts'
import type { Band } from '../compose/bands.ts'
import { SIGN } from './sign.ts'

/**
 * The band over the shopfront that carries the name, and the letter it sizes.
 * Every letter on the building is measured against this band, so a sign is
 * never taller than the wall it is on has room for.
 */
export interface Fascia {
  readonly bottom: number
  readonly top: number
  /** The tallest letter the building may carry. */
  readonly letter: number
}

/** How much of the fascia's height one letter may take. */
export const LETTER_SHARE = 0.5

/** A closer shorter than this is trim, not a fascia. */
const SHALLOWEST = 0.6

/** Clearance between the door head and a fascia cut above it. */
const OVER_DOOR = 0.15

/**
 * The ground floor's fascia: the kit's own metre-tall closer when the band has
 * one, otherwise what is left of the storey above the door head.
 */
export function fasciaOf(ground: Band): Fascia {
  const top = ground.base + ground.height
  const closer = ground.height - MODULE.height
  const bottom = closer >= SHALLOWEST ? top - closer : Math.min(top, METRICS.building.doorHeight + OVER_DOOR)
  return { bottom, top, letter: (top - bottom) * LETTER_SHARE }
}

/**
 * The wall signage is written against: the building's own height, or the
 * fascia plus `SIGN.climb`, whichever is lower. Every panel sized or placed
 * off the height of the wall reads this instead, so a forty storey tower hangs
 * the same street level signage a two storey shop does rather than a hundred
 * metre ribbon of neon up its corner.
 */
export function signWall(fascia: Fascia, height: number): number {
  return Math.min(height, fascia.top + SIGN.climb)
}
