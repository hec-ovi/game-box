import { SUNRISE_HOUR, SUNSET_HOUR } from '@gb/play'

/**
 * What an hour of the day means to the frame: how bright it is developed, how
 * the bright things glow, and what colour the dark is.
 *
 * Night is the look the city is built for. Once the sun is down, emissive is
 * the whole lighting budget, and what makes a sign read as light is the step
 * from it to the dark beside it. So the exposure comes down and the shadows go
 * cold, and the glow is set low and tight: it is there to say the sign is
 * brighter than the screen can show, not to spread it over the wall. Daylight
 * wants the opposite, because a sunlit wall is already brighter than any sign
 * on it and a low threshold there turns the whole frame to mush.
 */
export interface Look {
  /** Tone mapping exposure: how bright the frame is developed. */
  exposure: number
  /** The luminance a pixel has to reach before any of it glows. */
  threshold: number
  /** How much of the glow is added back over the frame. */
  strength: number
  /** How far the halo spreads: 0 tight around the source, 1 wide and soft. */
  radius: number
  /** How far the shadows are taken towards teal: 0 leaves them, 1 is the full tint. */
  cold: number
  /** 1 leaves colour alone, over 1 pushes it away from grey. */
  saturation: number
}

/**
 * Sunlight. The sun is low all day (24 degrees at noon on the temperate
 * theme) and the sky is a five to one gradient from a pale horizon to a blue
 * zenith, so a wall in the sun sits well above one in shade and the exposure
 * is set to hold both: high enough that the shaded face of a street reads,
 * low enough that a sunlit facade keeps its cladding rather than clipping to
 * one value. No glow, because a sunlit wall is already at the top of the range
 * and a halo over it lands on the wall rather than on any sign; no tint,
 * because daylight is the colour the art was painted. The threshold is set
 * above a sunlit wall, because it is what dusk crosses over from.
 */
export const DAY: Look = { exposure: 0.95, threshold: 4, strength: 0, radius: 0.25, cold: 0, saturation: 1.08 }

/**
 * After dark. The threshold is low so every sign is over it and the halo is
 * tight so none of them swallows the letters it belongs to: what makes neon
 * read is the step from the sign to the dark beside it, not the size of the
 * glow. The exposure comes down to hold that dark, and the shadows go cold so
 * the saturated hues have something to be saturated against.
 */
export const NIGHT: Look = { exposure: 0.8, threshold: 0.6, strength: 0.6, radius: 0.2, cold: 1, saturation: 1.25 }

/**
 * Inside a building. A room is lit by its own ceiling at every hour, so the
 * frame is developed the same way whatever the sky is doing outside.
 */
export const INDOORS: Look = { ...DAY, exposure: 1.15, saturation: 1 }

/**
 * How long the light takes to come up and go down when there is no sky to
 * read it off: an hour and a half either side of the whole hour the sun
 * crosses the horizon, which is the ramp the landscape's own daylight runs.
 */
const TWILIGHT = 1.5

/**
 * 0 in full daylight, 1 after dark, easing across dawn and dusk, off the hour
 * alone. For a city with no landscape round it: with one, the sky publishes
 * its own daylight and the grade reads that instead.
 */
export function darkness(hours: number): number {
  if (!Number.isFinite(hours)) return 0
  const h = ((hours % 24) + 24) % 24
  return 1 - Math.min(ramp(h, SUNRISE_HOUR - TWILIGHT, SUNRISE_HOUR + TWILIGHT), 1 - ramp(h, SUNSET_HOUR - TWILIGHT, SUNSET_HOUR + TWILIGHT))
}

/** How the frame is developed at a darkness: 0 is full daylight, 1 is after dark. A reading that is not a number is day. */
export function lookOf(night: number): Look {
  if (!Number.isFinite(night)) return DAY
  return blend(DAY, NIGHT, Math.min(1, Math.max(0, night)))
}

/** Smoothstep, so the grade has no corner in it that a player would see as a jump. */
function ramp(x: number, from: number, to: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

function blend(from: Look, to: Look, amount: number): Look {
  const mix = (a: number, b: number) => a * (1 - amount) + b * amount
  return {
    exposure: mix(from.exposure, to.exposure),
    threshold: mix(from.threshold, to.threshold),
    strength: mix(from.strength, to.strength),
    radius: mix(from.radius, to.radius),
    cold: mix(from.cold, to.cold),
    saturation: mix(from.saturation, to.saturation),
  }
}
