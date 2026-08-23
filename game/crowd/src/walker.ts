import { CLIPS } from '@gb/cast'
import type { Rng } from '@gb/kit'
import { headAim, type Attender, type Spot, TURN_EASE, TURN_QUICKEST, TURNED } from './attention.ts'
import { angleDelta, distance, easeToward, headingOf, turnToward } from './geometry.ts'
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
  /**
   * True for somebody walking the city on their own errand: talked to out in a
   * roadway, they finish the crossing and turn at the far kerb. A companion is
   * with the player wherever the player is, so they stop where they stand.
   */
  readonly finishesCrossings: boolean
}

/**
 * Close enough to a corner to call it turned, in metres. Well inside personal
 * space, so a corner is rounded rather than stepped on: asking for the exact
 * spot would let one person standing on it hold up everybody whose route turns
 * there, which is what a junction corner is once crossings send people to it.
 */
const ARRIVED = 0.3

/** Ground a walker has to gain on where it is going, in metres, before it counts as getting anywhere. */
const PROGRESS = 0.25

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
 *
 * Somebody can also be held: they stop where they are, turn to face whoever is
 * talking to them, and pick their route back up when they are let go.
 */
export class Walker implements Attender {
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
  #finishesCrossings: boolean
  #route: Point[] = []
  /** Metres from each corner to the end of the route, so `remaining` is a sum and not a walk of the route. */
  #after: number[] = []
  #leg = 0
  #state: WalkerState = 'idle'
  #clip: string = CLIPS.idle
  #pause = 0
  #facing = 0
  #stalled = 0
  #slowed = 0
  /** The least we have ever had left to walk on this route: what says whether we are getting anywhere. */
  #best = Infinity
  /** What the crowd is asking of us, and the way and pace we settled on. Kept here so a frame allocates nothing. */
  #urge: Urge = { x: 0, z: 0, pace: 1 }
  #wayX = 0
  #wayZ = 0
  #pace = 1
  /** Where somebody we are being held by is standing. Undefined when nobody is talking to us. */
  #attend: Spot | undefined
  /** Held while out in a roadway: walking to the far kerb, and turning to them once we are on it. */
  #crossingFirst = false
  /** As far round as our head reaches towards them. Kept here so watching somebody allocates nothing. */
  #head: Spot = { x: 0, y: 0, z: 0 }
  /** Let go of, and coming round to the way we were walking before we set off again. */
  #turningBack = false
  #gone = false

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
    this.#finishesCrossings = setup.finishesCrossings
    this.x = setup.at.x
    this.z = setup.at.z
    this.#actor.play(this.#clip)
    this.#report()
  }

  get state(): WalkerState {
    return this.#state
  }

  /** True when this walker is standing about with nowhere to go. Somebody mid-conversation is not free to go anywhere. */
  get wantsRoute(): boolean {
    return this.#state === 'idle' && this.#pause <= 0 && !this.#attend && !this.#turningBack
  }

  /** True while somebody is talking to us: we are standing still and turned to them. */
  get attending(): boolean {
    return this.#attend !== undefined
  }

  /** True once the body has been handed back. Whoever was holding us finds out this way. */
  get gone(): boolean {
    return this.#gone
  }

  /** Metres left to walk. Zero when idle. */
  get remaining(): number {
    const corner = this.#route[this.#leg]
    if (!corner) return 0
    return this.#after[this.#leg]! + distance(this.x, this.z, corner.x, corner.z)
  }

  /** Take a route in metres and start walking it. The first point may be where we stand. */
  follow(route: readonly Point[]): void {
    this.#route = route.filter((point) => distance(this.x, this.z, point.x, point.z) > ARRIVED)
    this.#measure()
    this.#leg = 0
    this.#stalled = 0
    this.#slowed = 0
    this.#best = Infinity
    if (this.#route.length === 0) {
      this.#rest()
      return
    }
    this.#state = 'walking'
    this.#setClip(this.moving)
    this.#aimAtLeg()
  }

  /**
   * Stop where we are and turn to face this point, until we are let go. The
   * route is kept, so being talked to costs the trip nothing but the time.
   *
   * Caught out in a roadway, the stopping waits: we walk the rest of the way
   * over and turn on the far kerb, because nobody stands in the road for a
   * conversation while the traffic comes. The hold itself is taken now, so the
   * game hears yes the moment it asks.
   */
  attend(x: number, y: number, z: number): void {
    if (this.#attend) {
      this.#attend.x = x
      this.#attend.y = y
      this.#attend.z = z
      return
    }
    this.#attend = { x, y, z }
    this.#turningBack = false
    if (this.#midCrossing()) this.#crossingFirst = true
    else this.#standToFace()
  }

  /** Part way over a crossing with somewhere to be: it is ours to finish before we turn. */
  #midCrossing(): boolean {
    if (!this.#finishesCrossings || this.#state === 'idle') return false
    return this.#kerb.crossing(this.x, this.z, this.#wayX, this.#wayZ)
  }

  /** Stand still, facing whoever is talking to us. The route is kept for afterwards. */
  #standToFace(): void {
    this.#crossingFirst = false
    this.#state = 'idle'
    this.#setClip(CLIPS.idle)
  }

  /** Let go: look away, come round to the way we were going, and walk on. */
  unattend(): void {
    if (!this.#attend) return
    this.#attend = undefined
    // let go of before we were over: we never stopped and never looked, so there is nothing to undo
    if (this.#crossingFirst) {
      this.#crossingFirst = false
      return
    }
    this.#actor.lookAway?.()
    this.#stalled = 0
    this.#slowed = 0
    const corner = this.#nextCorner()
    if (!corner) return
    this.#facing = headingOf(corner.x - this.x, corner.z - this.z)
    this.#turningBack = true
  }

  /** Walk for this long, then turn a little further towards where we are going. */
  advance(seconds: number): void {
    if (this.#attend && !this.#crossingFirst) return this.#watch(seconds, this.#attend)
    if (this.#turningBack) return this.#comeRound(seconds)
    const fromX = this.x
    const fromZ = this.z
    if (this.#state === 'idle') this.#pauseFor(seconds)
    else this.#travel(seconds)
    if (this.#state === 'walking') this.#setClip(this.moving)
    this.vx = seconds > 0 ? (this.x - fromX) / seconds : 0
    this.vz = seconds > 0 ? (this.z - fromZ) / seconds : 0
    this.heading = turnToward(this.heading, this.#facing, this.#turnRate * seconds)
    // across, or gone as far as we are going to get: now we turn to them
    if (this.#crossingFirst && (this.#ground.pavement(this.x, this.z) || this.#state === 'idle')) this.#standToFace()
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
    this.#gone = true
    this.#actor.release()
  }

  /** Finished with, but the body belongs to whoever handed it over. */
  retire(): void {
    this.#gone = true
  }

  /**
   * Being talked to: stood still, the body coming round to face them, the head
   * already there. The head leads as far as it turns and the body brings the
   * rest, which is somebody noticing you rather than a turret tracking you.
   */
  #watch(seconds: number, at: Spot): void {
    const dx = at.x - this.x
    const dz = at.z - this.z
    // somebody standing on top of us gives no direction to face: keep the one we have
    if (Math.hypot(dx, dz) > 1e-3) this.#facing = headingOf(dx, dz)
    this.#turn(seconds)
    headAim(this.x, this.z, this.heading, at, this.#head)
    this.#actor.lookAt?.(this.#head.x, this.#head.y, this.#head.z)
    this.#report()
  }

  /** Let go of: come round to the way we were walking before setting off again. */
  #comeRound(seconds: number): void {
    this.#turn(seconds)
    if (Math.abs(angleDelta(this.heading, this.#facing)) <= TURNED) {
      this.#turningBack = false
      this.#walkOn()
    }
    this.#report()
  }

  /** Stood on the spot, turning. Nobody is going anywhere, so nobody has to step around us. */
  #turn(seconds: number): void {
    this.vx = 0
    this.vz = 0
    this.heading = easeToward(this.heading, this.#facing, seconds, TURN_EASE, TURN_QUICKEST)
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
    const target = this.#nextCorner()
    if (!target) {
      this.#rest()
      return
    }

    this.#aside(target)
    this.#facing = headingOf(this.#wayX, this.#wayZ)
    if (!this.#kerb.safe(this.x, this.z, this.x + this.#wayX * wanted, this.z + this.#wayZ * wanted, this.speed)) {
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
    this.#settle(seconds)
  }

  /** How far each corner is from the end, once, so asking what is left costs one sum. */
  #measure(): void {
    const after = this.#after
    after.length = this.#route.length
    let left = 0
    for (let i = this.#route.length - 1; i >= 0; i--) {
      after[i] = left
      const corner = this.#route[i]!
      const before = this.#route[i - 1]
      if (before) left += distance(before.x, before.z, corner.x, corner.z)
    }
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

  /**
   * Held up or walking: what it looks like, and how long we put up with it
   * before trying another way. Being boxed in is measured by the ground gained
   * on where we are going, never by the ground covered: somebody shoved to and
   * fro in a scrum at a crossing covers plenty of metres and gets nowhere.
   */
  #settle(seconds: number): void {
    if (this.#pace < CRAWL) this.#slowed += seconds
    else this.#slowed = 0
    if (this.#slowed >= HELD) this.#hold()
    else if (this.#state === 'waiting') this.#walkOn()

    const left = this.remaining
    if (left <= this.#best - PROGRESS) {
      this.#best = left
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
