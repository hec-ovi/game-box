import { Rng } from '@gb/kit'
import { METRICS, type World } from '@gb/world'
import { distance } from './geometry.ts'
import { Ground } from './ground.ts'
import { resolveOptions, type CrowdOptions } from './options.ts'
import { Pavement } from './pavement.ts'
import { pedestrian } from './people.ts'
import type { CrowdCast, CrowdNav, Point, WalkerView } from './ports.ts'
import { Walker } from './walker.ts'

export interface CrowdDeps {
  readonly world: World
  readonly nav: CrowdNav
  readonly cast: CrowdCast
  /** Defaults to the city's own seed, so one city crowds the same way for everybody. */
  readonly seed?: string
}

/**
 * The people on the street. It keeps a population of walkers around the
 * player: spawns them on the pavement out of arm's reach, routes them
 * somewhere, walks them there, and retires the ones the player has left
 * behind, so the count stays what you asked for however far you travel.
 */
export class Crowd {
  readonly options: CrowdOptions
  #nav: CrowdNav
  #cast: CrowdCast
  #ground: Ground
  #pavement: Pavement
  #rng: Rng
  #walkers: Walker[] = []
  #serial = 0

  private constructor(deps: CrowdDeps, options: CrowdOptions) {
    this.options = options
    this.#nav = deps.nav
    this.#cast = deps.cast
    this.#ground = new Ground(deps.world, options.pavement, options.kerbHeight)
    this.#pavement = Pavement.from(deps.world, options.pavement)
    this.#rng = new Rng(deps.seed ?? `${deps.world.seed}/crowd`)
  }

  static create(deps: CrowdDeps, options: Partial<CrowdOptions> = {}): Crowd {
    return new Crowd(deps, resolveOptions(options))
  }

  get count(): number {
    return this.#walkers.length
  }

  /** A snapshot of everybody, for a HUD, a test or a debug overlay. */
  walkers(): readonly WalkerView[] {
    return this.#walkers.map((walker) => walker.view())
  }

  /** One frame: retire, walk, re-route, top up. In that order, so a fresh walker is never retired unwalked. */
  update(seconds: number, viewer: Point): void {
    const step = Math.min(Math.max(seconds, 0), this.options.maxStep)
    this.#retire(viewer)
    for (const walker of this.#walkers) walker.advance(step)
    this.#route()
    this.#populate(viewer)
  }

  /** Send everyone home. The cast gets every body back. */
  clear(): void {
    for (const walker of this.#walkers) walker.release()
    this.#walkers.length = 0
  }

  #retire(viewer: Point): void {
    for (let i = this.#walkers.length - 1; i >= 0; i--) {
      const walker = this.#walkers[i]!
      if (distance(viewer.x, viewer.z, walker.x, walker.z) <= this.options.retireRadius) continue
      this.#drop(i)
    }
  }

  #drop(index: number): void {
    const walker = this.#walkers[index]!
    walker.release()
    const last = this.#walkers.pop()!
    if (last !== walker) this.#walkers[index] = last
  }

  /** Give a route to whoever is standing about, up to this frame's ceiling of walkers. */
  #route(): void {
    let searches = 0
    for (let i = this.#walkers.length - 1; i >= 0 && searches < this.options.routesPerUpdate; i--) {
      const walker = this.#walkers[i]!
      if (!walker.wantsRoute) continue
      searches++
      if (!this.#sendSomewhere(walker)) this.#drop(i)
    }
  }

  /** True when the walker got a route. False means nowhere reachable, and they are done. */
  #sendSomewhere(walker: Walker): boolean {
    const from = this.#ground.cellAt(walker.x, walker.z)
    for (let attempt = 0; attempt < this.options.routeTries; attempt++) {
      const target = this.#pavement.pick(walker, this.options.tripMin, this.options.tripMax, walker.rng)
      if (!target) continue
      const path = this.#nav.path(from, target)
      if (!path) continue
      walker.follow(this.#nav.waypoints(path))
      return true
    }
    return false
  }

  #populate(viewer: Point): void {
    let spawned = 0
    while (this.#walkers.length < this.options.population && spawned < this.options.spawnsPerUpdate) {
      if (!this.#spawn(viewer)) return
      spawned++
    }
  }

  /**
   * One new walker. Their whole stream is forked from the seed and their
   * serial alone, so the tenth walker to appear draws the same numbers whether
   * they are the tenth or the only one, and adding one later moves nothing.
   */
  #spawn(viewer: Point): boolean {
    const serial = this.#serial
    const rng = this.#rng.fork(`walker/${serial}`)
    const cell = this.#pavement.pick(viewer, this.options.spawnNear, this.options.spawnFar, rng)
    if (!cell || !this.#nav.walkable(cell)) return false

    const spread = this.options.speedSpread
    const walker = new Walker({
      id: `walker_${serial}`,
      actor: this.#cast.spawn(pedestrian(serial, rng)),
      ground: this.#ground,
      at: this.#ground.centreOf(cell),
      speed: METRICS.player.walkSpeed * rng.range(1 - spread, 1 + spread),
      turnRate: this.options.turnRate,
      rng,
      pauseMin: this.options.pauseMin,
      pauseMax: this.options.pauseMax,
    })
    this.#walkers.push(walker)
    this.#serial++
    return true
  }
}
