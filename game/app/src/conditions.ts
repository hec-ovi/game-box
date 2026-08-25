import type { SettingsView } from '@gb/hud'
import { SUNRISE_HOUR, SUNSET_HOUR, WEATHERS, type GameClock, type Weather } from '@gb/play'

/**
 * The hours a jump lands on: dawn, the middle of the day, sundown, night. The
 * first and third are the whole hours `@gb/play` places the sun's crossings on,
 * which sit under the landscape's own sunrise and sunset, so a jump to dawn
 * lands with the sky lightening and the sun about to rise and a jump to
 * sundown with it still up.
 */
const STOPS = [SUNRISE_HOUR, 12, SUNSET_HOUR, 21] as const

const SKY: Record<Weather, string> = {
  clear: 'The sky clears',
  overcast: 'Cloud rolls in',
  rain: 'Rain sets in',
}

/**
 * The player's hand on the clock and the weather. Every reading and every rule
 * about them belongs to `@gb/play`; this only chooses which of its calls a key
 * or a setting makes, says in words what came back, and reads the clock for
 * the settings tab.
 */
export class Conditions {
  #clock: GameClock

  constructor(clock: GameClock) {
    this.#clock = clock
  }

  /**
   * Jump to the next time of day. Time only ever goes forward: wrapping past
   * midnight is tomorrow rather than eighteen hours ago, so skipping to dawn
   * runs a quest's timer down instead of winding it back.
   */
  nextTime(): string | undefined {
    const hour = STOPS.find((time) => time > this.#clock.hour)
    if (hour === undefined && !this.#clock.setDay(this.#clock.day + 1).ok) return undefined
    if (!this.#clock.setTime(hour ?? STOPS[0]).ok) return undefined
    return `${String(this.#clock.hour).padStart(2, '0')}:00, ${this.#clock.reading}`
  }

  /** Clear, overcast, rain, and round again. */
  nextWeather(): string | undefined {
    return this.setWeather(WEATHERS[(WEATHERS.indexOf(this.#clock.weather) + 1) % WEATHERS.length]!)
  }

  /** The sky the player picked, by name. A sky the game cannot draw changes nothing. */
  setWeather(weather: string): string | undefined {
    if (!(WEATHERS as readonly string[]).includes(weather)) return undefined
    return this.#clock.setWeather(weather as Weather).ok ? SKY[weather as Weather] : undefined
  }

  /** Hold the hour where it is, or let it run on at the rate it was running at. */
  hold(): string | undefined {
    return this.lock(!this.#clock.paused)
  }

  /** Hold the clock, or let it run. The rate it comes back at is the clock's own. */
  lock(locked: boolean): string | undefined {
    if (locked) this.#clock.pause()
    else this.#clock.resume()
    return locked ? 'Time held' : 'Time running'
  }

  /** The clock and the sky as the settings tab reads them. */
  view(): SettingsView {
    return {
      hour: this.#clock.hour,
      minute: this.#clock.minute,
      locked: this.#clock.paused,
      weather: this.#clock.weather,
      weathers: [...WEATHERS],
    }
  }
}
