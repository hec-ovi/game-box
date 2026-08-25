/** How one person feels about the player: a closed scale, moved one step at a time. */

export const DISPOSITIONS = ['hostile', 'cool', 'neutral', 'warm', 'friendly'] as const

export type Disposition = (typeof DISPOSITIONS)[number]

/** Somebody the player has not yet given a reason to feel otherwise. */
export const DEFAULT_DISPOSITION: Disposition = 'neutral'

/** One step along the scale, staying on it at either end. */
export function stepped(from: Disposition, by: 1 | -1): Disposition {
  const at = DISPOSITIONS.indexOf(from) + by
  return DISPOSITIONS[Math.max(0, Math.min(DISPOSITIONS.length - 1, at))] ?? from
}
