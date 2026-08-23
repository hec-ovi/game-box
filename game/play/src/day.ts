/** How long a day is, how fast it runs, and what each hour of it is called. */

export const SECONDS_PER_MINUTE = 60
export const MINUTES_PER_HOUR = 60
export const SECONDS_PER_HOUR = 3_600
export const SECONDS_PER_DAY = 86_400
export const HOURS_PER_DAY = 24

/**
 * Game seconds per real second. At 240 a whole day passes in six real minutes,
 * so an hour of game time takes fifteen seconds and a player meets dawn, noon
 * and midnight inside one short session instead of one real day.
 */
export const DEFAULT_RATE = 240

/** A day per real second is as fast as the clock goes; past that a frame skips whole days. */
export const MAX_RATE = SECONDS_PER_DAY

/** A new playthrough opens in the morning, with the town awake. */
export const DEFAULT_START_HOUR = 8

/** The sun is down from 20:00 up to 05:59. */
export const DARK_FROM_HOUR = 20
export const DARK_UNTIL_HOUR = 6

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
  { untilHour: 3, phase: 'night' },
  { untilHour: 5, phase: 'before-dawn' },
  { untilHour: 7, phase: 'dawn' },
  { untilHour: 11, phase: 'morning' },
  { untilHour: 14, phase: 'midday' },
  { untilHour: 17, phase: 'afternoon' },
  { untilHour: 20, phase: 'dusk' },
  { untilHour: 23, phase: 'evening' },
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
