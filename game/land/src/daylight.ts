import * as THREE from 'three'
import { smoothstep01 } from './height.ts'
import { sunStrength } from './preetham.ts'
import { SunPath } from './sunpath.ts'
import type { LandTheme } from './theme.ts'

/**
 * What the hour does to the light, as numbers anyone can read every frame.
 *
 * Everything here is a smooth function of the fractional hour, so dusk is a
 * slope and never a step: the sun's place on its arc, how far into twilight
 * the sky is, how strong the sun is through the air, and how far the afternoon
 * has cooled. The sky's brightness is written in by whoever paints the sky,
 * because it depends on the weather too. A caller that prefilters the dome
 * now and then reads `skyBrightness` and `sunYaw` to carry the environment
 * between one prefilter and the next.
 */
export class Daylight {
  /** Hours the sun crosses the horizon, and degrees it stands at noon. */
  readonly sunrise: number
  readonly sunset: number
  readonly noonElevation: number

  /** Unit vector towards the sun. The moon is its negative. */
  readonly sunward = new THREE.Vector3()
  /** Degrees above the horizon, negative below it. */
  sunElevation = 0
  /** Radians about +Y, `atan2(x, z)` of `sunward`: turn a prefiltered sky by the difference since it was filtered. */
  sunYaw = 0
  /** 0 in full night, 1 in full day, sloping between them across twilight. */
  day = 0
  /** 1 while the sun is low enough to be coloured by the air, 0 once it is well up. */
  low = 0
  /** 1 while the sky is dark enough for the stars, 0 once dawn has reached the horizon. */
  dark = 0
  /** 0 all morning, 1 by sunset: how far the afternoon has cooled from warm to cold. */
  dusk = 0
  /** The sun's strength through the air, 1 at noon and less the lower it stands. */
  sunStrength = 0
  /** Mean radiance of the whole dome over the upper hemisphere, in the dome's own units. */
  skyBrightness = 0
  hour = 12

  readonly #path: SunPath
  readonly #noonStrength: number

  constructor(theme: LandTheme) {
    this.#path = new SunPath(theme.sky.latitude, theme.sky.declination)
    this.sunrise = this.#path.sunrise
    this.sunset = this.#path.sunset
    this.noonElevation = this.#path.noonElevation
    this.#noonStrength = sunStrength(this.#path.at(12, this.sunward))
    this.set(this.hour)
  }

  /** Move to this hour, 0 to 24. */
  set(hour: number): void {
    this.hour = hour
    this.#path.at(hour, this.sunward)
    const height = this.sunward.y
    this.sunElevation = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(height, -1, 1)))
    this.sunYaw = Math.atan2(this.sunward.x, this.sunward.z)

    // full night seven degrees under the horizon, full day eleven above it
    this.day = smoothstep01((height + 0.12) / 0.32)
    this.low = 1 - smoothstep01((height - 0.05) / 0.3)
    // the stars go out as the sun comes up to the horizon, before the sky itself brightens
    this.dark = 1 - smoothstep01((height + 0.22) / 0.24)
    this.dusk = smoothstep01((hour - 12) / (this.sunset - 12))
    this.sunStrength = sunStrength(this.sunward) / this.#noonStrength
  }
}
