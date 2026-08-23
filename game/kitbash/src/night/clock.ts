/**
 * What the hour of the day does to the city's windows and lamps. This box holds
 * no clock: whoever owns one calls `setTime`, and this turns the reading into
 * the two numbers the shaders want.
 */

export interface NightLook {
  /** 0 in daylight, 1 in the dark: how strongly a lit window or a lamp reads. */
  readonly level: number
  /** The share of rooms with the lights on, 0 to 1. */
  readonly lit: number
}

/**
 * Keyframes, `[hour, level, lit]`, read round the clock. Evening is the busy
 * hour and the small hours are the quiet one, so between 21:00 and 03:00 most
 * of the lit windows go out one after another, always in the same order.
 */
const CURVE: readonly (readonly [number, number, number])[] = [
  [0, 1, 0.24],
  [3, 1, 0.11],
  [5, 1, 0.14],
  [6.5, 0, 0.03],
  [17.5, 0, 0.03],
  [19, 0.5, 0.34],
  [20.5, 1, 0.56],
  [23, 1, 0.44],
  [24, 1, 0.24],
]

/** The look of an hour, wrapping: 25 is 01:00 and -1 is 23:00. */
export function nightLook(hours: number): NightLook {
  const at = Number.isFinite(hours) ? ((hours % 24) + 24) % 24 : 12
  let after = 1
  while (CURVE[after]![0] < at) after++
  const [fromHour, fromLevel, fromLit] = CURVE[after - 1]!
  const [toHour, toLevel, toLit] = CURVE[after]!
  const t = (at - fromHour) / (toHour - fromHour)

  return { level: fromLevel + (toLevel - fromLevel) * t, lit: fromLit + (toLit - fromLit) * t }
}
