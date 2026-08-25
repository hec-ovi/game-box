import * as THREE from 'three'
import type { LightEmitter } from './emitter.ts'

/**
 * How many emitters are real lights at once. Every lit material pays for
 * every point light in the frame, so the count is a budget, not a count of
 * what is burning: the nearest this many to the camera are live, the rest are
 * emissive geometry until the camera comes closer.
 */
export const LIVE_LIGHTS = 16

/** Inverse square, the way a real lamp falls off. */
const DECAY = 2

/** An emitter standing in the city, in city metres. */
export interface PlacedEmitter extends LightEmitter {
  readonly plotId: string
}

/**
 * The lights the buildings throw onto the street, under a budget.
 *
 * Every emitter a dressing publishes is kept, in city metres. `LIVE_LIGHTS`
 * point lights are made once and stay in the scene whatever they are lighting,
 * so the shaders compile for one light count and never again; `follow` hands
 * them to the nearest emitters. Intensity is candela at full dark times the
 * city's night, so at noon the lamps are off and the emissive alone carries
 * the look, which is right: nothing glows in daylight.
 */
export class CityLights {
  readonly group = new THREE.Group()
  readonly #emitters: PlacedEmitter[] = []
  readonly #lights: THREE.PointLight[] = []
  readonly #budget: number
  #night: number
  #at: { x: number; z: number } | undefined

  constructor(night: number, budget = LIVE_LIGHTS) {
    this.group.name = 'lights'
    this.#budget = budget
    this.#night = 0
    this.night = night
    for (let at = 0; at < budget; at++) {
      const light = new THREE.PointLight(0xffffff, 0, 0, DECAY)
      light.name = `light:${at}`
      light.visible = false
      this.#lights.push(light)
      this.group.add(light)
    }
  }

  /** Every emitter standing in the city, live or not. */
  get emitters(): readonly PlacedEmitter[] {
    return this.#emitters
  }

  /** The point lights the budget allows, in the order they were cut. */
  get lights(): readonly THREE.PointLight[] {
    return this.#lights
  }

  get night(): number {
    return this.#night
  }

  /** 0 by day to 1 after dark; anything else is held to that, and a reading that is not a number is day. */
  set night(darkness: number) {
    this.#night = Number.isFinite(darkness) ? Math.min(1, Math.max(0, darkness)) : 0
    this.#burn()
  }

  /** One building's emitters, carried from its own frame to where it stands. */
  add(plotId: string, emitters: readonly LightEmitter[], at: THREE.Matrix4): void {
    const point = new THREE.Vector3()
    for (const emitter of emitters) {
      point.set(...emitter.position).applyMatrix4(at)
      this.#emitters.push({ ...emitter, plotId, position: [point.x, point.y, point.z] })
    }
    if (this.#at) this.follow(this.#at.x, this.#at.z)
  }

  /** Gives the live lights to the emitters nearest that point on the ground: the camera, every frame. */
  follow(x: number, z: number): void {
    this.#at = { x, z }
    const nearest = this.#nearest(x, z)
    this.#lights.forEach((light, index) => {
      const emitter = nearest[index]
      light.visible = emitter !== undefined
      if (!emitter) return
      light.position.set(...emitter.position)
      light.color.setHex(emitter.colour)
      light.distance = emitter.radius
      light.userData['emitter'] = emitter
    })
    this.#burn()
  }

  /** The closest emitters, nearest first, at most as many as there are lights. */
  #nearest(x: number, z: number): PlacedEmitter[] {
    const kept: Array<{ emitter: PlacedEmitter; distance: number }> = []
    for (const emitter of this.#emitters) {
      const distance = (emitter.position[0] - x) ** 2 + (emitter.position[2] - z) ** 2
      const last = kept[kept.length - 1]
      if (kept.length === this.#budget && (!last || distance >= last.distance)) continue
      let slot = kept.length
      while (slot > 0 && kept[slot - 1]!.distance > distance) slot--
      kept.splice(slot, 0, { emitter, distance })
      if (kept.length > this.#budget) kept.pop()
    }
    return kept.map((one) => one.emitter)
  }

  #burn(): void {
    for (const light of this.#lights) {
      const emitter = light.userData['emitter'] as PlacedEmitter | undefined
      light.intensity = emitter ? emitter.intensity * this.#night : 0
    }
  }
}
