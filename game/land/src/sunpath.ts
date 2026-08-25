import * as THREE from 'three'

const { degToRad, radToDeg } = THREE.MathUtils

/**
 * Where the sun is at any hour, for a place at this latitude on a day with
 * this solar declination.
 *
 * Two numbers give the whole day: how long it is, how high the sun gets, and
 * the arc it draws from where it rises to where it sets. A winter declination
 * makes the day short and the sun low at the same time, which is what a
 * night-first city wants: a few hours of long shadows and warm light rather
 * than a bright afternoon. Solar noon is 12:00 and the moon is the other end
 * of the same line.
 *
 * World frame: +X east, -Z north, +Y up.
 */
export class SunPath {
  /** Hours the sun crosses the horizon, and degrees it stands at noon. */
  readonly sunrise: number
  readonly sunset: number
  readonly noonElevation: number

  readonly #sinLat: number
  readonly #cosLat: number
  readonly #sinDec: number
  readonly #cosDec: number

  constructor(latitude: number, declination: number) {
    const lat = degToRad(latitude)
    const dec = degToRad(declination)
    this.#sinLat = Math.sin(lat)
    this.#cosLat = Math.cos(lat)
    this.#sinDec = Math.sin(dec)
    this.#cosDec = Math.cos(dec)

    // half the day, as an hour angle: clamped so a polar day or night still answers
    const halfDay = Math.acos(THREE.MathUtils.clamp(-Math.tan(lat) * Math.tan(dec), -1, 1))
    this.sunrise = 12 - radToDeg(halfDay) / 15
    this.sunset = 12 + radToDeg(halfDay) / 15
    this.noonElevation = 90 - Math.abs(latitude - declination)
  }

  /** Unit vector towards the sun at this hour. */
  at(hour: number, out: THREE.Vector3): THREE.Vector3 {
    const angle = degToRad((hour - 12) * 15)
    const east = -this.#cosDec * Math.sin(angle)
    const north = this.#sinDec * this.#cosLat - this.#cosDec * this.#sinLat * Math.cos(angle)
    const up = this.#sinDec * this.#sinLat + this.#cosDec * this.#cosLat * Math.cos(angle)
    return out.set(east, up, -north)
  }
}
