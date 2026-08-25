import { err, ok, type Result } from '@gb/kit'
import {
  DEFAULT_RATE,
  DEFAULT_START_HOUR,
  HOURS_PER_DAY,
  MAX_RATE,
  MINUTES_PER_HOUR,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  isDarkAt,
  phaseAt,
  readingAt,
  type DayPhase,
} from './day.ts'
import type { ClockDoc } from './schema.ts'
import { WEATHERS, type Weather } from './weather.ts'

export type ClockError =
  | { readonly code: 'invalid-rate'; readonly rate: number }
  | { readonly code: 'invalid-time'; readonly hour: number; readonly minute: number }
  | { readonly code: 'invalid-day'; readonly day: number }
  | { readonly code: 'unknown-weather'; readonly weather: string; readonly allowed: readonly Weather[] }

/**
 * What time it is in the playthrough and what the sky is doing. The game feeds
 * it real seconds each frame, anything that cares about the hour reads it, and
 * the sky box renders whatever it is told. It draws nothing itself.
 */
export class GameClock {
  #doc: ClockDoc
  #paused: boolean

  private constructor(doc: ClockDoc, paused: boolean) {
    this.#doc = doc
    this.#paused = paused
  }

  /** Day 1, morning, clear sky, running at the default rate. */
  static create(): GameClock {
    return new GameClock(
      { day: 1, secondsOfDay: DEFAULT_START_HOUR * SECONDS_PER_HOUR, rate: DEFAULT_RATE, weather: 'clear' },
      false,
    )
  }

  /**
   * Restore from a save. A save written before clocks existed has none and
   * starts fresh. One written before `paused` existed carried its pause as a
   * rate of 0, and opens paused with the default rate ready to resume at.
   */
  static from(doc: ClockDoc | undefined): GameClock {
    if (!doc) return GameClock.create()
    const { paused, ...rest } = doc
    const stopped = rest.rate === 0
    return new GameClock({ ...rest, rate: stopped ? DEFAULT_RATE : rest.rate }, paused ?? stopped)
  }

  get day(): number {
    return this.#doc.day
  }

  /** How far into the day it is, in game seconds. Fractional, so slow rates still move. */
  get secondsOfDay(): number {
    return this.#doc.secondsOfDay
  }

  get hour(): number {
    return Math.floor(this.#doc.secondsOfDay / SECONDS_PER_HOUR)
  }

  get minute(): number {
    return Math.floor((this.#doc.secondsOfDay % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  }

  /** Game seconds per real second while running, and what `resume` brings back. Always above 0. */
  get rate(): number {
    return this.#doc.rate
  }

  /** Whether the clock is stopped. Every reading holds still while it is. */
  get paused(): boolean {
    return this.#paused
  }

  get weather(): Weather {
    return this.#doc.weather
  }

  get phase(): DayPhase {
    return phaseAt(this.hour)
  }

  /** Plain English for the hour ("late evening"), for putting in front of a language model. */
  get reading(): string {
    return readingAt(this.hour)
  }

  /** True from 20:00 up to 05:59. The weather does not change it. */
  get isDark(): boolean {
    return isDarkAt(this.hour)
  }

  /** Whole game seconds since day 1 at 00:00. This is what the `clock` game event carries. */
  get totalSeconds(): number {
    return (this.#doc.day - 1) * SECONDS_PER_DAY + Math.floor(this.#doc.secondsOfDay)
  }

  /** Move the clock on by one frame. A step that is negative or not a number does nothing. */
  advance(realSeconds: number): void {
    if (this.#paused || !Number.isFinite(realSeconds) || realSeconds <= 0) return
    const moved = this.#doc.secondsOfDay + realSeconds * this.#doc.rate
    if (moved === this.#doc.secondsOfDay) return
    this.#doc.day += Math.floor(moved / SECONDS_PER_DAY)
    this.#doc.secondsOfDay = moved % SECONDS_PER_DAY
  }

  /** Run at a rate, and run: a positive rate also resumes a paused clock. 0 is `pause()`. */
  setRate(rate: number): Result<void, ClockError> {
    if (!Number.isFinite(rate) || rate < 0 || rate > MAX_RATE) return err({ code: 'invalid-rate', rate })
    if (rate === 0) {
      this.pause()
      return ok(undefined)
    }
    this.#doc.rate = rate
    this.#paused = false
    return ok(undefined)
  }

  /** Stop the clock. The rate it was running at is kept, and saved, for `resume`. */
  pause(): void {
    this.#paused = true
  }

  /** Run again at the rate it was running at. */
  resume(): void {
    this.#paused = false
  }

  /** Jump to an hour of the same day. */
  setTime(hour: number, minute = 0): Result<void, ClockError> {
    const badHour = !Number.isInteger(hour) || hour < 0 || hour >= HOURS_PER_DAY
    const badMinute = !Number.isInteger(minute) || minute < 0 || minute >= MINUTES_PER_HOUR
    if (badHour || badMinute) return err({ code: 'invalid-time', hour, minute })
    this.#doc.secondsOfDay = hour * SECONDS_PER_HOUR + minute * SECONDS_PER_MINUTE
    return ok(undefined)
  }

  /** Jump to a day, leaving the hour alone. */
  setDay(day: number): Result<void, ClockError> {
    if (!Number.isInteger(day) || day < 1) return err({ code: 'invalid-day', day })
    this.#doc.day = day
    return ok(undefined)
  }

  setWeather(weather: Weather): Result<void, ClockError> {
    if (!WEATHERS.includes(weather)) {
      return err({ code: 'unknown-weather', weather: String(weather), allowed: WEATHERS })
    }
    this.#doc.weather = weather
    return ok(undefined)
  }

  toJSON(): ClockDoc {
    return { ...this.#doc, paused: this.#paused }
  }
}
