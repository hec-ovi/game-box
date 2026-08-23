import type { Interior } from '@gb/world'
import { Doorways } from './doorway.ts'
import type { PropFootprint } from './footprint.ts'

/**
 * Ankle height. A piece no taller than this is walked over, not into: a rug, a
 * doormat, a floor tile. Everything from a low table up stops the player.
 */
export const STEP_OVER_HEIGHT = 0.25

/**
 * The furniture the player cannot walk through, measured off the objects that
 * were just built. Flat pieces are left out, and so is anything standing in a
 * doorway, because a footprint over the way out seals the player in.
 */
export function blockersOf(interior: Interior, footprints: Iterable<PropFootprint>): PropFootprint[] {
  const doorways = new Doorways(interior.doors)
  const blockers: PropFootprint[] = []
  for (const footprint of footprints) {
    if (footprint.height <= STEP_OVER_HEIGHT) continue
    if (footprint.halfWidth <= 0 || footprint.halfDepth <= 0) continue
    if (doorways.blockedBy(footprint)) continue
    blockers.push(footprint)
  }
  return blockers
}
