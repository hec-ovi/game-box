/** How long a day is, how fast it runs, and what each hour of it is called. */

export const SECONDS_PER_MINUTE = 60
export const MINUTES_PER_HOUR = 60
export const SECONDS_PER_HOUR = 3_600
export const SECONDS_PER_DAY = 86_400
export const HOURS_PER_DAY = 24

/**
 * Game seconds per real second. At 24 a whole day passes in one real hour, so an
 * hour of game time takes two and a half real minutes: long enough to walk
 * across town, do a job and come back without the light changing under you,
 * and short enough that a session still sees the hour turn. `T` skips ahead for
 * anyone who wants dawn now.
 */
export const DEFAULT_RATE = 24

/** A day per real second is as fast as the clock goes; past that a frame skips whole days. */
export const MAX_RATE = SECONDS_PER_DAY

/** A new playthrough opens in the morning, with the town awake. */
export const DEFAULT_START_HOUR = 8

/**
 * The phases and the dark hours follow the sun as `@gb/land` draws it: on the
 * temperate theme it rises at 07:25 and sets at 16:35 (arid 06:32 to 17:28,
 * maritime 07:44 to 16:16), with twilight about an hour either side. So `dawn`
 * is the hour before and the hour of sunrise, `dusk` the hour of and the hour
 * after sunset, and it is dark from 18:00 up to 05:59.
 */
export const SUNRISE_HOUR = 7
export const SUNSET_HOUR = 16
export const DARK_FROM_HOUR = SUNSET_HOUR + 2
export const DARK_UNTIL_HOUR = SUNRISE_HOUR - 1

/** The closed set of readings an hour can have. */
export const DAY_PHASES = [
  'night',
  'before-dawn',
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'dusk',
  'evening',
] as const

export type DayPhase = (typeof DAY_PHASES)[number]

/** Hour spans in order, each running up to (not including) `untilHour`. */
const SPANS: readonly { readonly untilHour: number; readonly phase: DayPhase }[] = [
  { untilHour: 4, phase: 'night' },
  { untilHour: SUNRISE_HOUR - 1, phase: 'before-dawn' },
  { untilHour: SUNRISE_HOUR + 1, phase: 'dawn' },
  { untilHour: 11, phase: 'morning' },
  { untilHour: 14, phase: 'midday' },
  { untilHour: SUNSET_HOUR, phase: 'afternoon' },
  { untilHour: SUNSET_HOUR + 2, phase: 'dusk' },
  { untilHour: 21, phase: 'evening' },
  { untilHour: HOURS_PER_DAY, phase: 'night' },
]

/** Plain English for a phase, written to drop straight into a prompt. */
const READINGS: Record<DayPhase, string> = {
  night: 'the dead of night',
  'before-dawn': 'just before dawn',
  dawn: 'first light',
  morning: 'mid morning',
  midday: 'the middle of the day',
  afternoon: 'the afternoon',
  dusk: 'sundown',
  evening: 'late evening',
}

export function phaseAt(hour: number): DayPhase {
  const span = SPANS.find((candidate) => hour < candidate.untilHour)
  return span ? span.phase : 'night'
}

export function readingAt(hour: number): string {
  return READINGS[phaseAt(hour)]
}

export function isDarkAt(hour: number): boolean {
  return hour >= DARK_FROM_HOUR || hour < DARK_UNTIL_HOUR
}
