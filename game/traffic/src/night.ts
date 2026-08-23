/**
 * When a driver puts the lights on. This box holds no clock: it is told an hour
 * and answers how lit the lamps are, 0 in daylight and 1 in the dark.
 *
 * Cars light up before the streetlights do and stay lit a while after dawn,
 * which is why this curve is its own and not the city's.
 */

/** Lamps go out over this stretch of the morning. */
const DAWN = { from: 5.5, to: 7 } as const
/** And come on over this stretch of the evening. */
const DUSK = { from: 16.5, to: 18.5 } as const

export function headlampLevel(hours: number): number {
  if (!Number.isFinite(hours)) return 0
  const h = ((hours % 24) + 24) % 24
  if (h <= DAWN.from || h >= DUSK.to) return 1
  if (h < DAWN.to) return 1 - ease((h - DAWN.from) / (DAWN.to - DAWN.from))
  if (h <= DUSK.from) return 0
  return ease((h - DUSK.from) / (DUSK.to - DUSK.from))
}

/** Smooth at both ends, so nothing snaps on. */
function ease(t: number): number {
  return t * t * (3 - 2 * t)
}
