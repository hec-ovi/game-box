import { DEFAULT_RATE, WEATHERS, type GameClock, type Weather } from '@gb/play'

/** The hours a jump lands on: dawn, the middle of the day, sundown, midnight. */
const TIMES = [0, 6, 12, 18] as const

const SKY: Record<Weather, string> = {
  clear: 'The sky clears',
  overcast: 'Cloud rolls in',
  rain: 'Rain sets in',
}

/**
 * The player's hand on the clock and the weather. Every reading and every rule
 * about them belongs to `@gb/play`; this only chooses which of its four calls a
 * key makes, and says in words what came back.
 */
export class Conditions {
  #clock: GameClock
  #running = DEFAULT_RATE

  constructor(clock: GameClock) {
    this.#clock = clock
    if (clock.rate > 0) this.#running = clock.rate
  }

  /**
   * Jump to the next time of day. Time only ever goes forward: wrapping past
   * midnight is tomorrow rather than eighteen hours ago, so skipping to dawn
   * runs a quest's timer down instead of winding it back.
   */
  nextTime(): string | undefined {
    const hour = TIMES.find((time) => time > this.#clock.hour)
    if (hour === undefined && !this.#clock.setDay(this.#clock.day + 1).ok) return undefined
    if (!this.#clock.setTime(hour ?? TIMES[0]).ok) return undefined
    return `${String(this.#clock.hour).padStart(2, '0')}:00, ${this.#clock.reading}`
  }

  /** Clear, overcast, rain, and round again. */
  nextWeather(): string | undefined {
    const next = WEATHERS[(WEATHERS.indexOf(this.#clock.weather) + 1) % WEATHERS.length]!
    return this.#clock.setWeather(next).ok ? SKY[next] : undefined
  }

  /** Hold the hour where it is, or let it run on at the rate it was running at. */
  hold(): string | undefined {
    const held = this.#clock.rate === 0
    if (!held) this.#running = this.#clock.rate
    if (!this.#clock.setRate(held ? this.#running : 0).ok) return undefined
    return held ? 'Time running' : 'Time held'
  }
}
