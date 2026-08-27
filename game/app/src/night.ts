import { SUNRISE_HOUR, SUNSET_HOUR } from '@gb/play'

/**
 * What an hour of the day means to the frame: how much of the sky it is lit by,
 * how bright it is developed, how the bright things glow, and what colour the
 * dark is.
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
  /**
   * How much of the prefiltered sky is reflected into every material. The
   * landscape's own hemisphere is the light the sky throws and is already right
   * at every hour; this is only what a surface gives back, and it is small
   * because a sky that lights the scene as well leaves the sun nothing to cast
   * with. Day and night share the number: the hour is already in the copy of
   * the dome, which runs 85 to 1 between noon and midnight.
   */
  environment: number
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
export const DAY: Look = { environment: 0.06, exposure: 0.95, threshold: 4, strength: 0, radius: 0.25, cold: 0, saturation: 1.08 }

/**
 * After dark. What makes neon read is the step from the sign to the dark beside
 * it, not the size of the glow, so the threshold sits above a wall a lamp is on
 * and under the letters themselves, and the halo is tight enough that no sign
 * swallows the letters it belongs to. The exposure comes down to hold that dark,
 * and the shadows go cold so the saturated hues have something to be saturated
 * against.
 *
 * Measured on one shopfront at midnight, against 0.6 / 0.6 / 0.2: the band
 * across the sign goes from 5.3% of its pixels over 200 to 3.4%, the door lamps
 * from 5.5% to 3.9% with nothing blown at all, and the whole frame from 1.09%
 * over 200 to 0.68%.
 */
export const NIGHT: Look = { environment: 0.06, exposure: 0.8, threshold: 0.9, strength: 0.35, radius: 0.15, cold: 1, saturation: 1.25 }

/**
 * Inside a building, at every hour: a room is lit by its own fixtures, so the
 * sky outside changes nothing here.
 *
 * A room's light now comes from where it is drawn, falls off with the square of
 * the distance and casts, so the frame has a top and a bottom that a flat fill
 * never gave it. Every number below is set against that:
 *
 * - **exposure** does not move. The fixtures were set so a room lands on the
 *   level the flat fill developed it at: over a town's twelve interiors, a
 *   floor takes a median 1.9 against the old 3.0 flat, a wall at eye height
 *   1.5 against 0.97 to 1.26, and a frame weighted the way a first person view
 *   is comes out within a tenth of a stop of where it was.
 * - **threshold** is what changed most. It sat at daylight's 4, and nothing
 *   indoors reaches 4, so no lit thing in any room has ever glowed. The gate is
 *   a hard one: over it a pixel goes into the halo whole, so the number has to
 *   sit clear of the brightest thing that is not a light. Measured off
 *   `@gb/furnish`'s own inks and its own fixtures: a lit channel emits 2.57 in
 *   both languages, a screen 0.68 to 0.82, a printed line 1.11, and the
 *   brightest lit surface a room makes, a pale worktop standing directly under
 *   a channel, comes to 1.19. 1.7 is between the last two with room either
 *   side, so what glows is what is burning.
 * - **strength and radius**: less than the street's and a little wider. A room
 *   is small and its bright things are close to the camera, so a street's tight
 *   hot halo lands on the wall beside it instead of hanging in the air.
 * - **cold** is half. The fixtures are the warm, bright end of the frame and
 *   the bounce off dark surfaces is all that is in the shadows, so pulling the
 *   shadows cool is what separates the two. Full cold is the street's, where
 *   there is night air between the player and everything.
 * - **environment** stays where it was: it is not what lights a room. The
 *   surfaces carry `@gb/furnish`'s own probe of the room, and this is only the
 *   night sky a pane gives back.
 */
export const INDOORS: Look = { environment: 0.02, exposure: 1.15, threshold: 1.7, strength: 0.28, radius: 0.18, cold: 0.5, saturation: 1.12 }

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

/** What a scene reflects the sky with: how strongly, and which way round it stands. */
export interface Reflection {
  environmentIntensity: number
  environmentRotation: { y: number }
}

/**
 * Point the prefiltered sky at a scene. Outdoors it is the hour's own share of
 * it, ridden by how much brighter the dome has got since the copy was taken and
 * turned by how far the sun has moved; the hour itself is in the copy, so this
 * is a correction rather than the whole of it.
 *
 * Indoors a room is lit by its own ceiling, so the sky drops to the little a
 * pane gives back and stops turning with a sun nobody in there can see. Without
 * that a room stands lit by whatever the sky was doing when the player walked
 * in, and the dome runs 85 to 1 between noon and midnight.
 */
export function reflectSky(scene: Reflection, at: { night: number; inside: boolean; brighter: number; turned: number }): void {
  const look = at.inside ? INDOORS : lookOf(at.night)
  scene.environmentIntensity = look.environment * (at.inside ? 1 : at.brighter)
  scene.environmentRotation.y = at.inside ? 0 : at.turned
}

/** Smoothstep, so the grade has no corner in it that a player would see as a jump. */
function ramp(x: number, from: number, to: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

function blend(from: Look, to: Look, amount: number): Look {
  const mix = (a: number, b: number) => a * (1 - amount) + b * amount
  return {
    environment: mix(from.environment, to.environment),
    exposure: mix(from.exposure, to.exposure),
    threshold: mix(from.threshold, to.threshold),
    strength: mix(from.strength, to.strength),
    radius: mix(from.radius, to.radius),
    cold: mix(from.cold, to.cold),
    saturation: mix(from.saturation, to.saturation),
  }
}
