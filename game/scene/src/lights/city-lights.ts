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

/**
 * How long a light takes to come up on an emitter it has just been handed, and
 * to go back down when it loses one. Without it a lamp arrives at its full
 * candela on the frame the player walks into its budget, which reads as a
 * light switching itself on in front of them.
 */
const FADE_SECONDS = 0.7

/**
 * How much further than the edge of the budget an emitter may sit and still
 * keep the light it already has, on squared distance, so about a fifth further
 * in metres. Two lamps either side of that edge would otherwise trade one light
 * back and forth while the player stands between them, and a fade cannot help
 * something that changes its mind every frame.
 */
const HOLD = 1.4

/**
 * How far the camera moves before the budget is cut again. Every emitter in the
 * city is measured to do it, and a lamp's falloff is metres wide, so cutting it
 * again inside a metre cannot change which lamps are nearest in any way a
 * player would see.
 */
const RESCAN = 1

/** An emitter standing in the city, in city metres. */
export interface PlacedEmitter extends LightEmitter {
  readonly plotId: string
}

/** One of the budget's lights, and what it is doing with the emitter it holds. */
interface Slot {
  readonly light: THREE.PointLight
  emitter: PlacedEmitter | undefined
  /** 0 dark, 1 at the emitter's own candela. */
  level: number
  /** It has lost its emitter, and has to reach 0 before it can take another. */
  leaving: boolean
}

/** An emitter with how far it is from the camera, squared. */
interface Near {
  readonly emitter: PlacedEmitter
  readonly distance: number
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
 *
 * A light does not arrive or leave on one frame. Handed an emitter it comes up
 * over `FADE_SECONDS`, and it goes down over the same before it will take
 * another, so walking down a street brings the lamps up ahead rather than
 * switching them on. `follow` told no elapsed time does all of it at once,
 * which is what a city opening at the spawn wants: lit on the first frame.
 */
export class CityLights {
  readonly group = new THREE.Group()
  readonly #emitters: PlacedEmitter[] = []
  readonly #lights: THREE.PointLight[] = []
  readonly #slots: Slot[] = []
  readonly #budget: number
  #night: number
  #at: { x: number; z: number } | undefined
  /** The nearest emitters as of the last cut of the budget, nearest first. */
  #near: Near[] = []
  /** Where that cut was made, and whether the set it was made from has changed since. */
  #cutAt: { x: number; z: number } | undefined
  #stale = true
  /** Whether the last `follow` was told to land at once, which is what a building put up mid-walk follows. */
  #snapped = true

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
      this.#slots.push({ light, emitter: undefined, level: 0, leaving: false })
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
    this.#stale = true
    this.#relight()
  }

  /** One building's emitters taken out again: what it threw stops being lit. */
  remove(plotId: string): void {
    let kept = 0
    for (const emitter of this.#emitters) if (emitter.plotId !== plotId) this.#emitters[kept++] = emitter
    this.#emitters.length = kept
    // a light on a building that is no longer standing loses it now, whatever
    // it was fading towards
    for (const slot of this.#slots) if (slot.emitter?.plotId === plotId) slot.leaving = true
    this.#stale = true
    this.#relight()
  }

  /**
   * The budget again after the set changed, in whatever way the city is
   * running: at once while it is being built, and over the frames once it is
   * being walked, because a building dressed mid-walk must not land its lights
   * on the frame it appears on.
   */
  #relight(): void {
    if (this.#at) this.follow(this.#at.x, this.#at.z, this.#snapped ? undefined : 0)
  }

  /**
   * Gives the live lights to the emitters nearest that point on the ground: the
   * camera, every frame. `seconds` is the frame's own elapsed time, and the
   * lights fade over it; left out, every light lands where it belongs at once.
   */
  follow(x: number, z: number, seconds?: number): void {
    this.#at = { x, z }
    const snap = seconds === undefined
    this.#snapped = snap
    if (snap || this.#recut(x, z)) this.#reassign(x, z, snap)
    this.#fade(snap ? 1 : Math.max(0, seconds) / FADE_SECONDS, snap)
    this.#burn()
  }

  /** Whether the budget is cut again: the set changed, or the camera has walked far enough to matter. */
  #recut(x: number, z: number): boolean {
    if (this.#stale || !this.#cutAt) return true
    return (this.#cutAt.x - x) ** 2 + (this.#cutAt.z - z) ** 2 >= RESCAN ** 2
  }

  /**
   * Which emitters have a light, from here. A light keeps the one it holds
   * while that one is still near enough, so a walk does not reshuffle the whole
   * budget over a step. Landing at once has no such loyalty: it is what a city
   * opening at the spawn does, and there the lights are simply the nearest.
   */
  #reassign(x: number, z: number, snap: boolean): void {
    this.#near = this.#nearest(x, z)
    this.#cutAt = { x, z }
    this.#stale = false
    // past the edge of the budget by `HOLD`, and a light lets its emitter go.
    // A budget that is not full has no edge: everything standing keeps its own.
    const worst = this.#near.length < this.#budget ? Number.POSITIVE_INFINITY : this.#near[this.#near.length - 1]!.distance
    const edge = snap ? worst : worst * HOLD
    for (const slot of this.#slots) {
      const held = slot.emitter
      if (!held || slot.leaving) continue
      const away = (held.position[0] - x) ** 2 + (held.position[2] - z) ** 2
      if (away > edge) slot.leaving = true
    }
  }

  /** Move every light towards where it is going, let go of the ones that got there, and hand the free ones an emitter. */
  #fade(step: number, snap: boolean): void {
    for (const slot of this.#slots) {
      if (slot.leaving) {
        slot.level = Math.max(0, slot.level - step)
        if (slot.level === 0) {
          slot.emitter = undefined
          slot.leaving = false
        }
      } else if (slot.emitter) {
        slot.level = Math.min(1, slot.level + step)
      }
    }

    const held = new Set<PlacedEmitter>()
    for (const slot of this.#slots) if (slot.emitter) held.add(slot.emitter)
    let next = 0
    for (const slot of this.#slots) {
      if (slot.emitter) continue
      while (next < this.#near.length && held.has(this.#near[next]!.emitter)) next++
      const taking = this.#near[next]?.emitter
      if (!taking) break
      next++
      held.add(taking)
      slot.emitter = taking
      slot.level = snap ? 1 : 0
      slot.light.position.set(...taking.position)
      slot.light.color.setHex(taking.colour)
      slot.light.distance = taking.radius
      slot.light.userData['emitter'] = taking
    }
  }

  /** The closest emitters, nearest first, at most as many as there are lights. */
  #nearest(x: number, z: number): Near[] {
    const kept: Near[] = []
    for (const emitter of this.#emitters) {
      const distance = (emitter.position[0] - x) ** 2 + (emitter.position[2] - z) ** 2
      const last = kept[kept.length - 1]
      if (kept.length === this.#budget && (!last || distance >= last.distance)) continue
      let slot = kept.length
      while (slot > 0 && kept[slot - 1]!.distance > distance) slot--
      kept.splice(slot, 0, { emitter, distance })
      if (kept.length > this.#budget) kept.pop()
    }
    return kept
  }

  #burn(): void {
    for (const slot of this.#slots) {
      slot.light.visible = slot.emitter !== undefined
      slot.light.intensity = slot.emitter ? slot.emitter.intensity * this.#night * slot.level : 0
    }
  }
}
