/**
 * What a lit thing in a room throws.
 *
 * Everything in this box that is lit is emissive geometry: a channel under the
 * wall rail, a line up a bay, a strip under a niche head, the glass of a
 * machine, a tile under a dancer. Emissive draws itself and lights nothing, so
 * each of those also publishes a `LightEmitter` from here, and `@gb/scene`
 * turns the few nearest the player into real point lights.
 *
 * The candela are not derived from the emissive. An emissive is authored so a
 * lens reads as a lens on screen under the app's tone map; taken as radiance it
 * comes to a fraction of what a room is developed for, because two square
 * metres of channel emitting 2.57 is sixteen lumens and a room needs some
 * hundreds. So the numbers below are set against what a room actually got
 * before: a flat hemisphere and a fixed lamp laying 3.0 lux on every upward
 * face wherever it stood. A room lit from here lands on the same average and
 * spreads it, which is the whole point: the same exposure, with somewhere to
 * stand in the light and somewhere to stand out of it.
 */
import type { LightEmitter } from '@gb/scene'
import type { Look } from '../build/look.ts'

/**
 * How far a fixture's light is lifted towards white from the colour of its own
 * lens. A lens is authored saturated so it reads as a line of light against a
 * dark wall; the same hue as the room's only illuminant makes a home a red
 * cave, because nothing in there is lit by anything else. Just over half way to
 * white keeps the hue and gives the surfaces their own colour back.
 */
const WASH = 0.55

/** Below this many lux a fixture is not worth drawing at all. */
const FAINT = 0.05

/** No fixture reaches further than this, whatever its candela: further than any room is wide. */
const REACH = 12

/**
 * Candela at the fixture. The cove is the room's ceiling light and is charged
 * by the metre of channel it stands for; the rest are single fittings.
 *
 * Set so a room is developed at the level it was before, measured over a town's
 * twelve interiors, standing in each of its thirty-six rooms in turn, under
 * `@gb/scene`'s twenty light budget: the floor takes a median 1.9 against the
 * flat rig's 3.0 everywhere, a wall at eye height 1.5 against 0.97 to 1.26, a
 * ceiling 2.0 against 1.7, and a frame weighted the way a first person view is
 * (half wall, a third floor, the rest ceiling and furniture) lands within a
 * tenth of a stop of where it was. What changed is the spread: a floor now runs
 * 0.36 to 4.11 between the fifth and the ninety-fifth percentile, and the flat
 * rig gave every point of every room the same number.
 */
export const FIXTURE = {
  /** The lit channel under the wall rail, per metre of the run it lights. */
  cove: 2.2,
  /** A light line up a bay, over its two metres. */
  strip: 2.8,
  /** The strip under a niche head, washing down onto the sill. */
  niche: 1.2,
  /** The rack of meters over a booth and the band across its front. */
  booth: 1.5,
  /** A pane onto the city three streets away: the one cold light in the room. */
  window: 0.9,
  /** The glass of a machine somebody works at. */
  screen: 0.4,
  /** One lit tile of a dance floor. */
  tile: 0.15,
} as const

/**
 * How long a stretch of channel one light stands for, so a ten metre run reads
 * as a line and not as one hot spot. Five metres: shorter costs emitters a
 * room's light budget cannot then hold, and a room's own walls are rarely
 * longer, so most runs come out as one light either way.
 */
export const COVE_SPAN = 5

/** How far a fixture of that strength is worth drawing: where it falls to `FAINT` lux, and never past `REACH`. */
function reachOf(candela: number): number {
  return Math.min(REACH, Math.sqrt(candela / FAINT))
}

/** Which of a look's two colours is its lens: what it emits, or its own colour when it emits nothing. */
export function lensOf(look: Look): number {
  return look.glow ?? look.colour
}

/** The colour a lens throws, as against the colour it reads as: itself, lifted towards white. */
export function washed(lens: number): number {
  let lifted = 0
  for (const shift of [16, 8, 0]) {
    const channel = (lens >> shift) & 0xff
    lifted |= Math.round(channel + (0xff - channel) * WASH) << shift
  }
  return lifted
}

/** One fixture, at a point in the interior's own metres. */
export function fixtureAt(kind: string, position: readonly [number, number, number], colour: number, candela: number): LightEmitter {
  return { kind, position, colour, intensity: candela, radius: reachOf(candela) }
}
