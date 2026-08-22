import { CLIPS } from '@gb/cast'
import type { Rng } from '@gb/kit'
import { distance, headingOf, turnToward } from './geometry.ts'
import type { Ground } from './ground.ts'
import type { Kerb } from './kerb.ts'
import type { CrowdActor, Point, WalkerState, WalkerView } from './ports.ts'
import type { Space, Urge } from './space.ts'

export interface WalkerSetup {
  readonly id: string
  readonly actor: CrowdActor
  readonly ground: Ground
  readonly space: Space
  readonly kerb: Kerb
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

/** Under this much of its pace, a walker is held up rather than walking slowly. */
const CRAWL = 0.15

/** How long it has to be held up before it stands instead of creeping, in seconds. Stops the clip flickering. */
const HELD = 0.3

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
  /** How it moved over the last frame, in metres per second, so everybody else can see it coming. */
  vx = 0
  vz = 0
  /** Metres per second. A follower winds this up to catch the player. */
  speed: number
  /** The clip to play while moving. A follower swaps it for a run when it has ground to make up. */
  moving: string = CLIPS.walk

  #actor: CrowdActor
  #ground: Ground
  #space: Space
  #kerb: Kerb
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
  #slowed = 0
  /** What the crowd is asking of us, and the way and pace we settled on. Kept here so a frame allocates nothing. */
  #urge: Urge = { x: 0, z: 0, pace: 1 }
  #wayX = 0
  #wayZ = 0
  #pace = 1

  constructor(setup: WalkerSetup) {
    this.id = setup.id
    this.rng = setup.rng
    this.#actor = setup.actor
    this.#ground = setup.ground
    this.#space = setup.space
    this.#kerb = setup.kerb
    this.speed = setup.speed
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
    this.#slowed = 0
    if (this.#route.length === 0) {
      this.#rest()
      return
    }
    this.#state = 'walking'
    this.#setClip(this.moving)
    this.#aimAtLeg()
  }

  /** Walk for this long, then turn a little further towards where we are going. */
  advance(seconds: number): void {
    const fromX = this.x
    const fromZ = this.z
    if (this.#state === 'idle') this.#pauseFor(seconds)
    else this.#travel(seconds)
    if (this.#state === 'walking') this.#setClip(this.moving)
    this.vx = seconds > 0 ? (this.x - fromX) / seconds : 0
    this.vz = seconds > 0 ? (this.z - fromZ) / seconds : 0
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

  /** Stand here, now, with nothing left to walk. For putting a companion back beside the player. */
  putAt(x: number, z: number): void {
    this.x = x
    this.z = z
    this.#stop(0)
    this.#report()
  }

  release(): void {
    this.#actor.release()
  }

  /** Standing about. Somebody walking into us is reason enough to move on early. */
  #pauseFor(seconds: number): void {
    this.#pause -= seconds
    if (this.#pause > 0 && this.#space.crowded(this)) this.#pause = 0
  }

  /**
   * One slice of walking: towards the next corner, bent around whoever is in
   * the way and slowed to whatever the pavement in front allows. The crowd is
   * read once a frame, so a long frame walks one considered step, not several
   * reactive ones.
   */
  #travel(seconds: number): void {
    const wanted = this.speed * seconds
    const fromX = this.x
    const fromZ = this.z
    const target = this.#nextCorner()
    if (!target) {
      this.#rest()
      return
    }

    this.#aside(target)
    this.#facing = headingOf(this.#wayX, this.#wayZ)
    if (!this.#kerb.safe(this.x, this.z, this.x + this.#wayX * wanted, this.z + this.#wayZ * wanted)) {
      this.#hold()
      return
    }

    let budget = wanted * this.#pace
    while (budget > 1e-9) {
      const corner = this.#nextCorner()
      if (!corner) break
      const step = Math.min(budget, distance(this.x, this.z, corner.x, corner.z))
      if (!this.#stride(step)) break
      budget -= step
    }

    if (this.#leg >= this.#route.length) {
      this.#rest()
      return
    }
    this.#settle(seconds, wanted, distance(fromX, fromZ, this.x, this.z))
  }

  /** The corner we are walking to, having stepped past any we are already standing on. */
  #nextCorner(): Point | undefined {
    while (this.#leg < this.#route.length) {
      const corner = this.#route[this.#leg]!
      if (distance(this.x, this.z, corner.x, corner.z) > ARRIVED) return corner
      this.#leg++
    }
    return undefined
  }

  /** Held up or walking: what it looks like, and how long we put up with it before trying another way. */
  #settle(seconds: number, wanted: number, moved: number): void {
    if (this.#pace < CRAWL) this.#slowed += seconds
    else this.#slowed = 0
    if (this.#slowed >= HELD) this.#hold()
    else if (this.#state === 'waiting') this.#walkOn()

    if (moved >= wanted * STALLED) {
      this.#stalled = 0
      return
    }
    this.#stalled += seconds
    if (this.#stalled >= this.#stuckSeconds) this.#stop(0)
  }

  /** Waiting: for a gap in the traffic, or for the person in front. Stood in an idle, not frozen mid-stride. */
  #hold(): void {
    this.#state = 'waiting'
    this.#setClip(CLIPS.idle)
  }

  /** Clear again: walk on, and no dawdling about it. */
  #walkOn(): void {
    this.#state = 'walking'
    this.#setClip(this.moving)
  }

  /** The way to step and how fast: the route, bent and slowed by everybody else on the pavement. */
  #aside(target: Point): void {
    const gap = distance(this.x, this.z, target.x, target.z)
    const dirX = (target.x - this.x) / gap
    const dirZ = (target.z - this.z) / gap
    this.#space.steer(this, dirX, dirZ, this.speed, this.#urge)
    this.#pace = this.#urge.pace
    const x = dirX + this.#urge.x
    const z = dirZ + this.#urge.z
    const length = Math.hypot(x, z)
    // leant straight back the way we came: step to the side instead of standing there
    if (length < 1e-6) {
      this.#wayX = -dirZ
      this.#wayZ = dirX
      return
    }
    this.#wayX = x / length
    this.#wayZ = z / length
  }

  /** Move, and if that way is taken, step aside or slide along rather than stopping dead. */
  #stride(step: number): boolean {
    if (this.#shift(this.#wayX, this.#wayZ, step)) return true
    // somebody is in the way: sideways, right first, because that is the side we pass on
    if (this.#shift(-this.#wayZ, this.#wayX, step)) return true
    if (this.#shift(this.#wayZ, -this.#wayX, step)) return true
    // a wall is in the way: along it
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

  /** Arrived, or never had anywhere to go: stand still for a moment. */
  #rest(): void {
    this.#stop(this.rng.range(this.#pauseMin, this.#pauseMax))
  }

  #stop(pause: number): void {
    this.#route = []
    this.#leg = 0
    this.#stalled = 0
    this.#slowed = 0
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
