import { METRICS } from '@gb/world'
import type { Ground } from './ground.ts'
import type { CrowdOptions } from './options.ts'
import type { CrowdNav, Point } from './ports.ts'

/** Anything that takes up room on the pavement: a walker, or the person playing. */
export interface Body {
  readonly x: number
  readonly z: number
}

/** A vector the caller owns, so feeling the crowd allocates nothing per frame. */
export interface Vector {
  x: number
  z: number
}

/** How much of the push is sideways when somebody is coming straight at us. */
const SIDESTEP = 0.9

/** How head-on a body has to be before we pass it on our right rather than just lean away. */
const HEAD_ON = 0.3

/**
 * The room a walker has: who is standing next to it and where the ground takes
 * feet. Bodies are bucketed once a frame, so keeping thirty people out of each
 * other costs a handful of lookups each rather than comparing everybody to
 * everybody.
 */
export class Space {
  #ground: Ground
  #nav: CrowdNav
  #personal: number
  #reach: number
  #strength: number
  #bucket: number
  #buckets = new Map<number, Body[]>()
  #spare: Body[][] = []
  #used = 0
  #viewer: Point = { x: 0, z: 0 }
  /** Who is near, and who they are near. Worked out once per body per frame and reused, and it allocates nothing. */
  #near: Body[] = []
  #focus: Body | undefined

  constructor(ground: Ground, nav: CrowdNav, options: CrowdOptions) {
    this.#ground = ground
    this.#nav = nav
    this.#personal = options.personalSpace
    this.#reach = options.avoidRadius
    this.#strength = options.avoidStrength
    // a body can move this far between two frames, so the buckets are a step wider than the reach
    const fastest = METRICS.player.walkSpeed * (1 + options.speedSpread)
    this.#bucket = options.avoidRadius + fastest * options.maxStep
  }

  /** Where everybody stands this frame. Walkers are held by reference, so a body that moves stays current. */
  begin(walkers: readonly Body[], viewer: Point): void {
    for (let i = 0; i < this.#used; i++) this.#spare[i]!.length = 0
    this.#buckets.clear()
    this.#used = 0
    this.#focus = undefined
    this.#viewer = viewer
    for (const walker of walkers) this.add(walker)
  }

  /** A body that appeared after `begin`, so the next one to spawn can see it. */
  add(body: Body): void {
    this.#bucketAt(body.x, body.z).push(body)
    this.#focus = undefined
  }

  /** True when a body may stand here: on the map, and not inside a building, a mountain or water. */
  open(x: number, z: number): boolean {
    return this.#nav.walkable(this.#ground.cellAt(x, z))
  }

  /** True when nobody is standing within personal space of this point. Used before putting somebody new on the street. */
  clear(x: number, z: number): boolean {
    this.#fill(x, z, undefined)
    this.#focus = undefined
    return this.#closest(this.#near, x, z) >= this.#personal
  }

  /** True when somebody is inside this body's personal space, the player included. */
  crowded(self: Body): boolean {
    return this.#closest(this.#around(self), self.x, self.z) < this.#personal
  }

  /**
   * True when a body may step from where it is to (x, z). A step never enters
   * somebody's personal space, and a body already inside one may only move out
   * of it, so two people never end up in the same square metre.
   */
  allows(self: Body, x: number, z: number): boolean {
    for (const other of this.#around(self)) {
      const after = Math.hypot(x - other.x, z - other.z)
      if (after >= this.#personal) continue
      if (after < Math.hypot(self.x - other.x, self.z - other.z)) return false
    }
    return true
  }

  /**
   * Which way the crowd is leaning on a body that wants to walk `forward`.
   * Everybody inside the avoid radius pushes it away, and anybody coming the
   * other way is passed on the right, so a head-on pair parts instead of
   * stopping dead in front of each other.
   */
  push(self: Body, forwardX: number, forwardZ: number, out: Vector): void {
    out.x = 0
    out.z = 0
    for (const other of this.#around(self)) {
      const dx = self.x - other.x
      const dz = self.z - other.z
      const gap = Math.hypot(dx, dz)
      if (gap >= this.#reach) continue
      const weight = this.#strength * (1 - gap / this.#reach)
      // two bodies in one spot have no direction to part in, so they step aside instead
      const awayX = gap > 1e-6 ? dx / gap : -forwardZ
      const awayZ = gap > 1e-6 ? dz / gap : forwardX
      out.x += awayX * weight
      out.z += awayZ * weight
      if (-awayX * forwardX - awayZ * forwardZ <= HEAD_ON) continue
      out.x += -forwardZ * weight * SIDESTEP
      out.z += forwardX * weight * SIDESTEP
    }
  }

  /** How far the nearest of these bodies is from a point. */
  #closest(bodies: readonly Body[], x: number, z: number): number {
    let nearest = Infinity
    for (const other of bodies) nearest = Math.min(nearest, Math.hypot(x - other.x, z - other.z))
    return nearest
  }

  /**
   * Everybody near a body, the player included. One scan lasts that body's
   * whole frame: it reaches a step further than the avoid radius, so it still
   * holds after the body has taken that step.
   */
  #around(self: Body): readonly Body[] {
    if (this.#focus !== self) {
      this.#focus = self
      this.#fill(self.x, self.z, self)
    }
    return this.#near
  }

  /** The scan itself, into the one list this holds. */
  #fill(x: number, z: number, self: Body | undefined): void {
    const found = this.#near
    found.length = 0
    const bx = Math.floor(x / this.#bucket)
    const bz = Math.floor(z / this.#bucket)
    for (let ix = bx - 1; ix <= bx + 1; ix++) {
      for (let iz = bz - 1; iz <= bz + 1; iz++) {
        const bucket = this.#buckets.get(key(ix, iz))
        if (!bucket) continue
        for (const body of bucket) {
          if (body === self) continue
          if (Math.hypot(x - body.x, z - body.z) < this.#bucket) found.push(body)
        }
      }
    }
    if (Math.hypot(x - this.#viewer.x, z - this.#viewer.z) < this.#bucket) found.push(this.#viewer)
  }

  #bucketAt(x: number, z: number): Body[] {
    const at = key(Math.floor(x / this.#bucket), Math.floor(z / this.#bucket))
    const held = this.#buckets.get(at)
    if (held) return held
    const list = this.#spare[this.#used] ?? (this.#spare[this.#used] = [])
    this.#used++
    this.#buckets.set(at, list)
    return list
  }
}

/**
 * One number per bucket. Two far-apart buckets may land on the same number;
 * every scan measures the real distance anyway, so a clash costs a comparison
 * and nothing else.
 */
function key(x: number, z: number): number {
  return (x * 73856093) ^ (z * 19349663)
}
