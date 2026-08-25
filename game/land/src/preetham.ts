import * as THREE from 'three'
import type { LandTheme } from './theme.ts'

/**
 * The daylight sky the dome draws, on the CPU: the same Preetham model as
 * three's `SkyMesh`, term for term, so a number read here is the number the
 * shader paints. It is what lets this box say how bright the sky is without a
 * renderer, and how strong the sun is through the air at any height.
 */

const TOTAL_RAYLEIGH = new THREE.Vector3(5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5)
const MIE_CONST = new THREE.Vector3(1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14)
const RAYLEIGH_ZENITH = 8.4e3
const MIE_ZENITH = 1.25e3
/** The earth-shadow hack: how the sun's strength dies as it nears the horizon. */
const CUTOFF = 1.6110731556870734
const STEEPNESS = 1.5
const EE = 1000
const THREE_OVER_SIXTEEN_PI = 0.05968310365946075
const ONE_OVER_FOUR_PI = 0.07957747154594767
const UP = new THREE.Vector3(0, 1, 0)

/** Directions the hemisphere is sampled at: elevations and how many bearings round each. */
const ELEVATIONS = [4, 15, 30, 50, 70, 85]
const BEARINGS = 12

/** The sun's strength at this height, before any air is in the way. `sunward` is the unit vector towards it. */
export function sunStrength(sunward: THREE.Vector3): number {
  const zenith = Math.acos(THREE.MathUtils.clamp(sunward.dot(UP), -1, 1))
  return EE * Math.max(0, 1 - Math.exp(-(CUTOFF - zenith) / STEEPNESS))
}

export class Preetham {
  readonly #betaR = new THREE.Vector3()
  readonly #betaM = new THREE.Vector3()
  readonly #g: number
  readonly #samples: THREE.Vector3[] = []
  readonly #weights: number[] = []
  readonly #direction = new THREE.Vector3()
  readonly #colour = new THREE.Vector3()

  constructor(sky: LandTheme['sky']) {
    this.#betaR.copy(TOTAL_RAYLEIGH).multiplyScalar(sky.rayleigh)
    this.#betaM.copy(MIE_CONST).multiplyScalar(0.434 * 0.2 * sky.turbidity * 1e-17 * sky.mie)
    this.#g = sky.mieDirection

    let total = 0
    for (const elevation of ELEVATIONS) {
      const up = Math.sin(THREE.MathUtils.degToRad(elevation))
      const ring = Math.cos(THREE.MathUtils.degToRad(elevation))
      for (let bearing = 0; bearing < BEARINGS; bearing++) {
        const yaw = (bearing / BEARINGS) * Math.PI * 2
        this.#samples.push(new THREE.Vector3(Math.sin(yaw) * ring, up, Math.cos(yaw) * ring))
        // a ring near the horizon is a bigger share of the sky than one near the zenith
        this.#weights.push(ring)
        total += ring
      }
    }
    for (let i = 0; i < this.#weights.length; i++) this.#weights[i]! /= total
  }

  /** The sky's radiance in a direction, in the dome's own units, with the sun where `sunward` says. */
  radiance(direction: THREE.Vector3, sunward: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    return this.#scatter(direction, sunward, this.#g, out)
  }

  /**
   * Mean luminance of the clear sky over the upper hemisphere, in the dome's
   * own units. The sun's aureole is left out by scattering the haze evenly:
   * it is a few degrees of sky that a handful of samples would count as a
   * whole quarter of it, and it moves with the sun, so keeping it would make
   * this number jump as the sun passed each sample.
   */
  brightness(sunward: THREE.Vector3): number {
    let sum = 0
    for (let i = 0; i < this.#samples.length; i++) {
      const colour = this.#scatter(this.#direction.copy(this.#samples[i]!), sunward, 0, this.#colour)
      sum += this.#weights[i]! * (0.2126 * colour.x + 0.7152 * colour.y + 0.0722 * colour.z)
    }
    return sum
  }

  #scatter(direction: THREE.Vector3, sunward: THREE.Vector3, g: number, out: THREE.Vector3): THREE.Vector3 {
    const sunE = sunStrength(sunward)
    const zenithAngle = Math.acos(Math.max(0, direction.dot(UP)))
    const inverse = 1 / (Math.cos(zenithAngle) + 0.15 * Math.pow(93.885 - THREE.MathUtils.radToDeg(zenithAngle), -1.253))
    const sR = RAYLEIGH_ZENITH * inverse
    const sM = MIE_ZENITH * inverse

    const cosTheta = direction.dot(sunward)
    const c = cosTheta * 0.5 + 0.5
    const rPhase = THREE_OVER_SIXTEEN_PI * (1 + c * c)
    const g2 = g * g
    const mPhase = (ONE_OVER_FOUR_PI * (1 - g2)) / Math.pow(1 - 2 * g * cosTheta + g2, 1.5)
    const horizonSun = THREE.MathUtils.clamp(Math.pow(1 - sunward.dot(UP), 5), 0, 1)

    for (const channel of ['x', 'y', 'z'] as const) {
      const betaR = this.#betaR[channel]
      const betaM = this.#betaM[channel]
      const fex = Math.exp(-(betaR * sR + betaM * sM))
      const scatter = (sunE * (betaR * rPhase + betaM * mPhase)) / (betaR + betaM)
      let lin = Math.pow(scatter * (1 - fex), 1.5)
      lin *= 1 + (Math.pow(scatter * fex, 0.5) - 1) * horizonSun
      out[channel] = (lin + 0.1 * fex) * 0.04
    }
    out.y += 0.0003
    out.z += 0.00075
    return out
  }
}
