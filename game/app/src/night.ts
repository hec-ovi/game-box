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
 * Sunlight, which adds nothing. A sunlit wall is already at the top of the
 * range the tone map has to spend, so a glow over it lands on the wall rather
 * than on any sign, and the frame goes milky; and there is nothing to tint,
 * because daylight is the colour the art was painted. The threshold is still
 * set to above a sunlit wall, because it is what dusk crosses over from.
 */
export const DAY: Look = { exposure: 1.15, threshold: 4, strength: 0, radius: 0.25, cold: 0, saturation: 1 }

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
export const INDOORS: Look = DAY

/** Sunrise and sunset in `@gb/land` are 06:00 and 18:00; these are the edges of the two twilights. */
const DAWN = [5, 8] as const
const DUSK = [16, 19.5] as const

/** 0 in full daylight, 1 after dark, easing across dawn and dusk. */
export function darkness(hours: number): number {
  if (!Number.isFinite(hours)) return 0
  const h = ((hours % 24) + 24) % 24
  return 1 - Math.min(ramp(h, DAWN[0], DAWN[1]), 1 - ramp(h, DUSK[0], DUSK[1]))
}

/** How the frame is developed at an hour of the day. */
export function lookAt(hours: number): Look {
  return blend(DAY, NIGHT, darkness(hours))
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
