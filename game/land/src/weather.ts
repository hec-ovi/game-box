import type { Rng } from '@gb/kit'
import * as THREE from 'three'

export type Weather = 'clear' | 'overcast' | 'rain'

export const WEATHERS: readonly Weather[] = ['clear', 'overcast', 'rain']

/** What one kind of weather does to the light, the haze, the cloud and the rain. */
export interface WeatherLook {
  /** Multipliers on the sun and moon, and on the ambient that fills in behind them. */
  readonly light: number
  readonly ambient: number
  /** Multipliers on where the haze starts and ends. */
  readonly fogNear: number
  readonly fogFar: number
  /** How far the haze and the light are pulled towards storm grey. */
  readonly grey: number
  /** How far the sky's cloud is pushed towards solid overcast. */
  readonly cloud: number
  /** Share of the drop budget that falls. */
  readonly fall: number
  /** 0 dry to 1 soaked, for anything that wants to look wet. */
  readonly wetness: number
}

export const WEATHER: Record<Weather, WeatherLook> = {
  clear: { light: 1, ambient: 1, fogNear: 1, fogFar: 1, grey: 0, cloud: 0, fall: 0, wetness: 0 },
  overcast: { light: 0.45, ambient: 1.15, fogNear: 0.6, fogFar: 0.55, grey: 0.55, cloud: 0.75, fall: 0, wetness: 0.15 },
  rain: { light: 0.28, ambient: 1.1, fogNear: 0.35, fogFar: 0.3, grey: 0.78, cloud: 0.92, fall: 1, wetness: 1 },
}

/** Metres of the box of rain carried around the viewer. */
export const RAIN_VOLUME = new THREE.Vector3(26, 20, 26)
/** Metres of the volume that sit below the viewer. */
const RAIN_BELOW = 5
/** Metres a second, and the length of the streak that leaves behind it. */
const FALL_SPEED = 16
const STREAK = 0.6
/** How far the fall leans off vertical. */
const WIND = new THREE.Vector3(0.14, -1, 0.06).normalize()

/**
 * Rain as streaks in a box that travels with the viewer.
 *
 * Drops keep their own world positions and wrap around the box when they leave
 * it, so walking through the rain moves you through it rather than dragging a
 * cage of it along. Positions are stepped on the CPU and uploaded once a frame,
 * which is the same cost on the WebGPU and the WebGL2 backend.
 */
export class Rainfall {
  readonly object: THREE.LineSegments
  readonly #drops: Float32Array
  readonly #position: THREE.BufferAttribute
  readonly #count: number
  #drawn = 0

  constructor(count: number, rng: Rng) {
    this.#count = count
    this.#drops = new Float32Array(count * 3)
    for (let drop = 0; drop < count; drop++) {
      this.#drops[drop * 3] = (rng.float() - 0.5) * RAIN_VOLUME.x
      this.#drops[drop * 3 + 1] = rng.float() * RAIN_VOLUME.y - RAIN_BELOW
      this.#drops[drop * 3 + 2] = (rng.float() - 0.5) * RAIN_VOLUME.z
    }

    this.#position = new THREE.BufferAttribute(new Float32Array(count * 6), 3)
    this.#position.setUsage(THREE.DynamicDrawUsage)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', this.#position)
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), RAIN_VOLUME.length())

    this.object = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xaec6d6, transparent: true, opacity: 0.42, depthWrite: false }),
    )
    this.object.name = 'land:rain'
    this.object.frustumCulled = false
    this.object.visible = false
  }

  /** 0 for dry, 1 for all of it. Drops are drawn or not, never made again. */
  setFall(share: number): void {
    this.#drawn = Math.round(this.#count * Math.min(1, Math.max(0, share)))
    this.object.geometry.setDrawRange(0, this.#drawn * 2)
    this.object.visible = this.#drawn > 0
  }

  /** How many streaks fall at the heaviest, and how many are falling now. */
  get capacity(): number {
    return this.#count
  }

  get drops(): number {
    return this.#drawn
  }

  /** Fall for this long, around a viewer who may have moved. */
  update(seconds: number, viewer: THREE.Vector3): void {
    if (this.#drawn === 0) return
    const step = FALL_SPEED * Math.min(seconds, 0.1)
    const halfX = RAIN_VOLUME.x / 2
    const halfZ = RAIN_VOLUME.z / 2
    const out = this.#position.array as Float32Array

    for (let drop = 0; drop < this.#drawn; drop++) {
      const at = drop * 3
      const x = wrap(this.#drops[at]! + WIND.x * step - viewer.x, halfX) + viewer.x
      const z = wrap(this.#drops[at + 2]! + WIND.z * step - viewer.z, halfZ) + viewer.z
      const fallen = this.#drops[at + 1]! + WIND.y * step - viewer.y + RAIN_BELOW
      const y = mod(fallen, RAIN_VOLUME.y) - RAIN_BELOW + viewer.y

      this.#drops[at] = x
      this.#drops[at + 1] = y
      this.#drops[at + 2] = z

      const head = drop * 6
      out[head] = x
      out[head + 1] = y
      out[head + 2] = z
      out[head + 3] = x - WIND.x * STREAK
      out[head + 4] = y - WIND.y * STREAK
      out[head + 5] = z - WIND.z * STREAK
    }
    this.#position.needsUpdate = true
    this.object.position.set(0, 0, 0)
  }
}

/** Back into [-half, half), whichever side it left from. */
function wrap(value: number, half: number): number {
  return mod(value + half, half * 2) - half
}

function mod(value: number, span: number): number {
  return ((value % span) + span) % span
}
