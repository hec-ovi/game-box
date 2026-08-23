import type { Rng } from '@gb/kit'

/**
 * The colours the city's signage is lit in. Cyan and teal carry the street and
 * everything else is an accent, which is how a wet neon street reads: one cold
 * hue everywhere and a few hot ones punching out of it.
 *
 * A building draws its own hue, and its second and third signs draw against it,
 * so no two signs on one facade wear the same colour and a run of buildings
 * does not turn into one long stripe.
 */

/** A neon colour: what the tubes are, and how hard they burn. */
export interface Neon {
  readonly ink: number
  /** Multiplies the emissive, so a red tube can hold its own against a cyan one. */
  readonly glow: number
}

const CYAN: Neon = { ink: 0x22e2ff, glow: 1 }
const TEAL: Neon = { ink: 0x19f0c4, glow: 1 }
const ICE: Neon = { ink: 0x9fe9ff, glow: 0.9 }
const MAGENTA: Neon = { ink: 0xff3fa4, glow: 1.15 }
const CRIMSON: Neon = { ink: 0xff2f52, glow: 1.25 }
const AMBER: Neon = { ink: 0xffab34, glow: 1.05 }
const WARM: Neon = { ink: 0xffe2b4, glow: 0.85 }
const LIME: Neon = { ink: 0x66ff6a, glow: 1 }
const VIOLET: Neon = { ink: 0x9d6bff, glow: 1.2 }

/** How often each colour turns up when a building picks its own. */
const HOUSE: ReadonlyArray<readonly [Neon, number]> = [
  [CYAN, 26], [TEAL, 20], [ICE, 9], [MAGENTA, 15], [CRIMSON, 8], [AMBER, 11], [LIME, 5], [VIOLET, 4], [WARM, 2],
]

/** The colours a second sign on the same wall reaches for: hot against the cold. */
const AGAINST: ReadonlyArray<readonly [Neon, number]> = [
  [MAGENTA, 22], [AMBER, 20], [CRIMSON, 14], [LIME, 10], [VIOLET, 8], [WARM, 8], [CYAN, 10], [TEAL, 8],
]

/** The backs of the boxes the tubes are mounted on: near black, faintly cold. */
const BACKING: readonly number[] = [0x090b10, 0x0c0d12, 0x07090c, 0x0b0e16]

/** A doorway, a canopy, a window strip: always warm, always low. */
export const DOORLIGHT: Neon = { ink: 0xffcf8a, glow: 0.55 }

/** The hue a whole building is lit in. */
export function houseNeon(rng: Rng): Neon {
  return rng.weighted(HOUSE)
}

/** A hue for the next sign on that wall, never the one already burning there. */
export function againstNeon(rng: Rng, taken: Neon): Neon {
  const left = AGAINST.filter(([neon]) => neon !== taken)
  return rng.weighted(left)
}

/** The dark box a tube is mounted on. */
export function backing(rng: Rng): number {
  return rng.pick(BACKING)
}
