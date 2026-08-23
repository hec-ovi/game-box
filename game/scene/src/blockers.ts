import type { Interior } from '@gb/world'
import type * as THREE from 'three'
import { Doorways } from './doorway.ts'
import { PropFootprint } from './footprint.ts'

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
export function blockersOf(interior: Interior, props: ReadonlyMap<string, THREE.Object3D>): PropFootprint[] {
  const doorways = new Doorways(interior.doors)
  const blockers: PropFootprint[] = []
  for (const piece of interior.furniture) {
    const object = props.get(piece.id)
    if (!object) continue
    const footprint = new PropFootprint(piece.id, piece.prop, object)
    if (footprint.height <= STEP_OVER_HEIGHT) continue
    if (footprint.halfWidth <= 0 || footprint.halfDepth <= 0) continue
    if (doorways.blockedBy(footprint)) continue
    blockers.push(footprint)
  }
  return blockers
}
