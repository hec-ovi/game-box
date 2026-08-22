import type { Rng } from '@gb/kit'
import { CLIPS } from '@gb/cast'
import { distance, headingOf, turnToward } from './geometry.ts'
import type { Ground } from './ground.ts'
import type { CrowdActor, Point, WalkerState, WalkerView } from './ports.ts'

export interface WalkerSetup {
  readonly id: string
  readonly actor: CrowdActor
  readonly ground: Ground
  readonly at: Point
  readonly speed: number
  readonly turnRate: number
  readonly rng: Rng
  readonly pauseMin: number
  readonly pauseMax: number
}

/**
 * One pedestrian. It owns a route in metres and walks it: no steering, no
 * avoidance, no opinions about the city. The route came from `@gb/nav`, which
 * already refused to cross a building, so following it exactly is what keeps a
 * walker out of the walls.
 */
export class Walker {
  readonly id: string
  readonly rng: Rng
  x: number
  z: number
  heading = 0

  #actor: CrowdActor
  #ground: Ground
  #speed: number
  #turnRate: number
  #pauseMin: number
  #pauseMax: number
  #route: Point[] = []
  #leg = 0
  #state: WalkerState = 'idle'
  #clip: string = CLIPS.idle
  #pause = 0
  #facing = 0

  constructor(setup: WalkerSetup) {
    this.id = setup.id
    this.rng = setup.rng
    this.#actor = setup.actor
    this.#ground = setup.ground
    this.#speed = setup.speed
    this.#turnRate = setup.turnRate
    this.#pauseMin = setup.pauseMin
    this.#pauseMax = setup.pauseMax
    this.x = setup.at.x
    this.z = setup.at.z
    this.#actor.play(this.#clip)
    this.#push()
  }

  get state(): WalkerState {
    return this.#state
  }

  /** True when this walker is standing about with nowhere to go. */
  get wantsRoute(): boolean {
    return this.#state === 'idle' && this.#pause <= 0
  }

  /** Metres left to walk. Zero when idle. */
  get remaining(): number {
    let left = 0
    let fromX = this.x
    let fromZ = this.z
    for (let i = this.#leg; i < this.#route.length; i++) {
      const point = this.#route[i]!
      left += distance(fromX, fromZ, point.x, point.z)
      fromX = point.x
      fromZ = point.z
    }
    return left
  }

  /** Take a route in metres and start walking it. The first point may be where we stand. */
  follow(route: readonly Point[]): void {
    this.#route = route.filter((point) => distance(this.x, this.z, point.x, point.z) > 1e-6)
    this.#leg = 0
    if (this.#route.length === 0) {
      this.#rest()
      return
    }
    this.#state = 'walking'
    this.#setClip(CLIPS.walk)
    this.#aimAtLeg()
  }

  /** Walk for this long, then turn a little further towards where we are going. */
  advance(seconds: number): void {
    if (this.#state === 'walking') this.#travel(this.#speed * seconds)
    else this.#pause -= seconds
    this.heading = turnToward(this.heading, this.#facing, this.#turnRate * seconds)
    this.#push()
  }

  view(): WalkerView {
    return {
      id: this.id,
      x: this.x,
      z: this.z,
      heading: this.heading,
      state: this.#state,
      clip: this.#clip,
      remaining: this.remaining,
    }
  }

  release(): void {
    this.#actor.release()
  }

  #travel(budget: number): void {
    let left = budget
    while (left > 0 && this.#leg < this.#route.length) {
      const target = this.#route[this.#leg]!
      const dx = target.x - this.x
      const dz = target.z - this.z
      const step = Math.hypot(dx, dz)
      this.#facing = headingOf(dx, dz)
      if (step > left) {
        const part = left / step
        this.x += dx * part
        this.z += dz * part
        return
      }
      this.x = target.x
      this.z = target.z
      left -= step
      this.#leg++
    }
    this.#rest()
  }

  /** Arrived, or never had anywhere to go: stand still for a moment. */
  #rest(): void {
    this.#route = []
    this.#leg = 0
    this.#state = 'idle'
    this.#pause = this.rng.range(this.#pauseMin, this.#pauseMax)
    this.#setClip(CLIPS.idle)
  }

  #aimAtLeg(): void {
    const target = this.#route[this.#leg]
    if (!target) return
    this.#facing = headingOf(target.x - this.x, target.z - this.z)
  }

  #setClip(clip: string): void {
    if (this.#clip === clip) return
    this.#clip = clip
    this.#actor.play(clip)
  }

  #push(): void {
    this.#actor.placeAt(this.x, this.#ground.heightAt(this.x, this.z), this.z)
    this.#actor.faceTo(this.heading)
  }
}
