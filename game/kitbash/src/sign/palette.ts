import type { Rng } from '@gb/kit'
import * as THREE from 'three'

/**
 * The colours the city's signage is lit in. Cyan and teal carry the street and
 * everything else is an accent, which is how a wet neon street reads: one cold
 * hue everywhere and a few hot ones punching out of it.
 *
 * A building draws its own hue, and its second and third signs draw against it,
 * so no two signs on one facade wear the same colour and a run of buildings
 * does not turn into one long stripe.
 */

/** A neon colour: what the tubes are, and how hard they burn over their own colour. */
export interface Neon {
  readonly ink: number
  /** Multiplies its own colour after dark. A tube runs past it; a lamp and a whole panel alight stay under it. */
  readonly glow: number
}

/**
 * The luminance a tube emits after dark, whatever colour it burns.
 *
 * A multiplier is not a brightness. 0x22e2ff carries 0.62 of luminance and
 * 0xff2f52 carries 0.24, so one strength over the two put the cold half of the
 * palette over the app's night bloom threshold and left the hot half under it:
 * the three colours meant to punch out of a street were the three that never
 * wore a halo. Authored as the luminance a tube emits, all nine clear the same
 * threshold at the same reading and there is one number to tune instead of
 * nine.
 */
const TUBE = 1.3

/** How hard a lamp or a whole panel alight burns, as a share of its own colour: enough to read as lit, never past white. */
const SURFACE = 0.9

/** A tube of that colour, burning at `TUBE` however light or dark the colour is. */
function tube(ink: number): Neon {
  return { ink, glow: TUBE / luminanceOf(ink) }
}

/** How bright a packed colour is in the renderer's working space. */
export function luminanceOf(hex: number): number {
  const colour = new THREE.Color().setHex(hex, THREE.SRGBColorSpace)
  return 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b
}

const CYAN = tube(0x22e2ff)
const TEAL = tube(0x19f0c4)
const ICE = tube(0x9fe9ff)
const MAGENTA = tube(0xff3fa4)
const CRIMSON = tube(0xff2f52)
const AMBER = tube(0xffab34)
const WARM = tube(0xffe2b4)
const LIME = tube(0x66ff6a)
const VIOLET = tube(0x9d6bff)

/** How often each colour turns up when a building picks its own. */
const HOUSE: ReadonlyArray<readonly [Neon, number]> = [
  [CYAN, 26], [TEAL, 20], [ICE, 9], [MAGENTA, 15], [CRIMSON, 8], [AMBER, 11], [LIME, 5], [VIOLET, 4], [WARM, 2],
]

/** Every colour a sign in the city is lit in, so what each of them emits can be read side by side. */
export const NEON: readonly Neon[] = HOUSE.map(([neon]) => neon)

/** The colours a second sign on the same wall reaches for: hot against the cold. */
const AGAINST: ReadonlyArray<readonly [Neon, number]> = [
  [MAGENTA, 22], [AMBER, 20], [CRIMSON, 14], [LIME, 10], [VIOLET, 8], [WARM, 8], [CYAN, 10], [TEAL, 8],
]

/** The backs of the boxes the tubes are mounted on: near black, faintly cold. */
const BACKING: readonly number[] = [0x090b10, 0x0c0d12, 0x07090c, 0x0b0e16]

/** The box over a subway entrance: warm white on every station in town, because a station is wayfinding. */
export const TRANSIT = tube(0xfff0c8)

/** The lamp at a door: always warm, and never past its own colour, because a lamp is not a tube. */
export const DOORLIGHT: Neon = { ink: 0xffcf8a, glow: SURFACE }

/** How hard a whole panel alight burns, as a share of its own colour: the same rule as the lamp at the door. */
export const LIGHTBOX = SURFACE

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
