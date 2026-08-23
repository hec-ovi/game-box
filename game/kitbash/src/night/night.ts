import { uniform } from 'three/tsl'
import { nightLook } from './clock.ts'

/**
 * The two numbers every night surface in the city reads: how dark it is, and
 * what share of rooms have their lights on. One of these per loaded kit, so
 * setting the time is two uniform writes for the whole city however many
 * buildings and lamps are standing in it.
 */
export class CityNight {
  /** 0 in daylight, 1 in the dark. */
  readonly level = uniform(0)
  /** The share of rooms lit, which windows compare their own key against. */
  readonly lit = uniform(0.03)

  #hours = 12

  /** The hour it was last told. */
  get hours(): number {
    return this.#hours
  }

  /** Moves the city to an hour of the day. Cheap enough for every frame. */
  setTime(hours: number): void {
    if (!Number.isFinite(hours)) return
    this.#hours = ((hours % 24) + 24) % 24
    const look = nightLook(this.#hours)
    this.level.value = look.level
    this.lit.value = look.lit
  }
}
