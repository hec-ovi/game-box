import { CLIPS } from '@gb/cast'
import type { Rng } from '@gb/kit'
import { distance, headingOf, turnToward } from './geometry.ts'
import type { Ground } from './ground.ts'
import type { CrowdActor, Point, WalkerState, WalkerView } from './ports.ts'
import type { Space, Vector } from './space.ts'

export interface WalkerSetup {
  readonly id: string
  readonly actor: CrowdActor
  readonly ground: Ground
  readonly space: Space
  readonly at: Point
  readonly speed: number
  readonly turnRate: number
  readonly stuckSeconds: number
  readonly rng: Rng
  readonly pauseMin: number
  readonly pauseMax: number
}

/** Close enough to a corner to call it turned, in metres. */
const ARRIVED = 0.05

/** Under this share of the step it asked for, a walker is not walking, it is boxed in. */
const STALLED = 0.05

/**
 * One pedestrian. It owns a route in metres and walks it, leaning around
 * anybody in the way: no opinions about the city, no idea where it is going
 * beyond the next corner. The route came from `@gb/nav`, which already refused
 * to cross a building, and every step is checked against walkable ground, so
 * neither the route nor a shove around somebody puts a walker in a wall.
 */
export class Walker {
  readonly id: string
  readonly rng: Rng
  x: number
  z: number
  heading = 0

  #actor: CrowdActor
  #ground: Ground
  #space: Space
  #speed: number
  #turnRate: number
  #stuckSeconds: number
  #pauseMin: number
  #pauseMax: number
  #route: Point[] = []
  #leg = 0
  #state: WalkerState = 'idle'
  #clip: string = CLIPS.idle
  #pause = 0
  #facing = 0
  #stalled = 0
  /** Where the crowd is leaning on us, and the way we settled on. Kept here so a frame allocates nothing. */
  #pushed: Vector = { x: 0, z: 0 }
  #wayX = 0
  #wayZ = 0

  constructor(setup: WalkerSetup) {
    this.id = setup.id
    this.rng = setup.rng
    this.#actor = setup.actor
    this.#ground = setup.ground
    this.#space = setup.space
    this.#speed = setup.speed
    this.#turnRate = setup.turnRate
    this.#stuckSeconds = setup.stuckSeconds
    this.#pauseMin = setup.pauseMin
    this.#pauseMax = setup.pauseMax
    this.x = setup.at.x
    this.z = setup.at.z
    this.#actor.play(this.#clip)
    this.#report()
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
    this.#route = route.filter((point) => distance(this.x, this.z, point.x, point.z) > ARRIVED)
    this.#leg = 0
    this.#stalled = 0
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
    if (this.#state === 'walking') this.#travel(seconds)
    else this.#wait(seconds)
    this.heading = turnToward(this.heading, this.#facing, this.#turnRate * seconds)
    this.#report()
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

  /** Standing about. Somebody walking into us is reason enough to move on early. */
  #wait(seconds: number): void {
    this.#pause -= seconds
    if (this.#pause > 0 && this.#space.crowded(this)) this.#pause = 0
  }

  /** One slice of walking: towards the next corner, bent around whoever is in the way. */
  #travel(seconds: number): void {
    const wanted = this.#speed * seconds
    const fromX = this.x
    const fromZ = this.z
    let budget = wanted

    while (budget > 1e-9 && this.#leg < this.#route.length) {
      const target = this.#route[this.#leg]!
      const dx = target.x - this.x
      const dz = target.z - this.z
      const gap = Math.hypot(dx, dz)
      if (gap <= ARRIVED) {
        this.#leg++
        continue
      }
      const step = Math.min(budget, gap)
      this.#aside(dx / gap, dz / gap)
      this.#facing = headingOf(this.#wayX, this.#wayZ)
      if (!this.#stride(step)) break
      budget -= step
    }

    if (this.#leg >= this.#route.length) {
      this.#rest()
      return
    }
    this.#wearOut(seconds, wanted, distance(fromX, fromZ, this.x, this.z))
  }

  /** The way to step: the route, bent by whoever is standing in it. */
  #aside(dirX: number, dirZ: number): void {
    this.#space.push(this, dirX, dirZ, this.#pushed)
    const x = dirX + this.#pushed.x
    const z = dirZ + this.#pushed.z
    const length = Math.hypot(x, z)
    // pushed straight back the way we came: step to the side instead of standing there
    if (length < 1e-6) {
      this.#wayX = -dirZ
      this.#wayZ = dirX
      return
    }
    this.#wayX = x / length
    this.#wayZ = z / length
  }

  /** Move, sliding along whatever will not let us past rather than stopping dead on it. */
  #stride(step: number): boolean {
    if (this.#shift(this.#wayX, this.#wayZ, step)) return true
    if (this.#wayX !== 0 && this.#shift(Math.sign(this.#wayX), 0, step * Math.abs(this.#wayX))) return true
    if (this.#wayZ !== 0 && this.#shift(0, Math.sign(this.#wayZ), step * Math.abs(this.#wayZ))) return true
    return false
  }

  /** One step, taken only if the ground allows feet and nobody is standing there. */
  #shift(dirX: number, dirZ: number, step: number): boolean {
    const x = this.x + dirX * step
    const z = this.z + dirZ * step
    if (!this.#space.open(x, z) || !this.#space.allows(this, x, z)) return false
    this.x = x
    this.z = z
    return true
  }

  /** Boxed in for long enough: drop the route and ask for another rather than shuffling on the spot. */
  #wearOut(seconds: number, wanted: number, moved: number): void {
    if (moved >= wanted * STALLED) {
      this.#stalled = 0
      return
    }
    this.#stalled += seconds
    if (this.#stalled >= this.#stuckSeconds) this.#stop(0)
  }

  /** Arrived, or never had anywhere to go: stand still for a moment. */
  #rest(): void {
    this.#stop(this.rng.range(this.#pauseMin, this.#pauseMax))
  }

  #stop(pause: number): void {
    this.#route = []
    this.#leg = 0
    this.#stalled = 0
    this.#state = 'idle'
    this.#pause = pause
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

  /** Hand the body where we stand and which way we look. Everything else about it is the cast's business. */
  #report(): void {
    this.#actor.placeAt(this.x, this.#ground.heightAt(this.x, this.z), this.z)
    this.#actor.faceTo(this.heading)
  }
}
