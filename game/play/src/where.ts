/** Where the player is standing: metres, the way they are facing, and the room they are in. */
import type { WhereDoc } from './schema.ts'

/** A whole turn in radians. A heading is kept inside one, so a save never carries a wound-up angle. */
export const TWO_PI = Math.PI * 2

/**
 * The same direction, said between 0 and one whole turn. An angle already in
 * that span comes back exactly as it went in: the wrapping arithmetic costs a
 * bit of the mantissa, and a heading that survives a save should be the one
 * that was reported.
 */
export function normalizeHeading(radians: number): number {
  if (radians >= 0 && radians < TWO_PI) return radians
  const turned = ((radians % TWO_PI) + TWO_PI) % TWO_PI
  return turned < TWO_PI ? turned : 0
}

/**
 * A place the game reported, ready to be remembered: the heading wound into one
 * turn, and nothing at all when the numbers are not real, so a bad frame can
 * never write a save that will not load again.
 */
export function placeOf(where: WhereDoc): WhereDoc | undefined {
  const { x, z, heading, interiorId } = where
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(heading)) return undefined
  const place: WhereDoc = { x, z, heading: normalizeHeading(heading) }
  return interiorId ? { ...place, interiorId } : place
}
