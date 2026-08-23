import { Rng } from '@gb/kit'
import { METRICS, type Npc, type World } from '@gb/world'
import { Crossings } from './crossings.ts'
import { Escort } from './escort.ts'
import { distance } from './geometry.ts'
import { Ground } from './ground.ts'
import { Kerb } from './kerb.ts'
import { resolveOptions, type CrowdOptions } from './options.ts'
import { Pavement } from './pavement.ts'
import { STRANGERS } from './people.ts'
import type {
  Companion,
  CrowdCast,
  CrowdGround,
  CrowdNav,
  CrowdPeople,
  Hazards,
  Point,
  WalkerView,
} from './ports.ts'
import { Router } from './router.ts'
import { Space } from './space.ts'
import { Walker } from './walker.ts'

export interface CrowdDeps {
  readonly world: World
  readonly nav: CrowdNav
  readonly cast: CrowdCast
  /** What is moving on the roads, so walkers look before they step off the kerb. None means no traffic to look for. */
  readonly hazards?: Hazards
  /** The ground past the edge of the city, for feet and for what may be walked on. None means the grid is all there is. */
  readonly ground?: CrowdGround
  /** Who is out on the street. With none, the crowd mints strangers of its own. */
  readonly people?: CrowdPeople
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
  #people: CrowdPeople
  #ground: Ground
  #pavement: Pavement
  #space: Space
  #kerb: Kerb
  #router: Router
  #rng: Rng
  #walkers: Walker[] = []
  /** Who each walker is, by their own id: what the game reads to talk to somebody it passed. */
  #street = new Map<string, Npc>()
  #escort: Escort
  /** Everybody the steering has to know about, rebuilt each frame rather than allocated. */
  #bodies: Walker[] = []
  #serial = 0
  /** The next walker's stream, kept between attempts so a blocked spot is not drawn again forever. */
  #pending: Rng | undefined

  private constructor(deps: CrowdDeps, options: CrowdOptions) {
    this.options = options
    this.#nav = deps.nav
    this.#cast = deps.cast
    this.#people = deps.people ?? STRANGERS
    this.#ground = new Ground(deps.world, options.pavement, options.kerbHeight, deps.ground)
    this.#pavement = Pavement.from(deps.world, options.pavement)
    this.#space = new Space(this.#ground, deps.nav, options)
    this.#kerb = new Kerb(this.#ground, options, deps.hazards)
    this.#router = new Router({
      nav: deps.nav,
      ground: this.#ground,
      crossings: Crossings.from(deps.world, options.pavement),
      detour: options.crossingDetour,
    })
    this.#rng = new Rng(deps.seed ?? `${deps.world.seed}/crowd`)
    this.#escort = new Escort({
      nav: deps.nav,
      ground: this.#ground,
      space: this.#space,
      kerb: this.#kerb,
      cast: deps.cast,
      options,
      rng: this.#rng,
    })
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

  /** Who is walking with the player, in the order they joined. Their ids are their NPC ids. */
  following(): readonly WalkerView[] {
    return this.#escort.list()
  }

  /**
   * The person behind a walker or a companion, by the id their view carries.
   * Unknown ids answer nothing: they have gone home, or they were never here.
   */
  person(id: string): Npc | undefined {
    return this.#street.get(id) ?? this.#escort.person(id)
  }

  /**
   * Somebody comes along with the player. Following twice is following once.
   * They are never retired by distance, so they last as long as this crowd
   * does; `clear()` sends them home with everybody else.
   */
  follow(who: Companion): void {
    this.#escort.follow(who)
  }

  /** They stop walking with the player. A body the crowd spawned goes back to the cast; one the game handed over does not. */
  stopFollowing(npcId: string): void {
    this.#escort.stop(npcId)
  }

  /** One frame: retire, walk, re-route, top up. In that order, so a fresh walker is never retired unwalked. */
  update(seconds: number, viewer: Point): void {
    const step = Math.min(Math.max(seconds, 0), this.options.maxStep)
    this.#retire(viewer)
    this.#space.begin(this.#everybody(), viewer, step)
    for (const walker of this.#walkers) walker.advance(step)
    this.#escort.advance(step, this.#space.viewer)
    this.#route()
    this.#populate(viewer)
  }

  /** Send everyone home, companions included. The cast gets every body back. */
  clear(): void {
    for (const walker of this.#walkers) walker.release()
    this.#walkers.length = 0
    this.#street.clear()
    this.#escort.clear()
  }

  /** Walkers and companions together: everybody the steering has to keep apart. */
  #everybody(): readonly Walker[] {
    const bodies = this.#bodies
    bodies.length = 0
    for (const walker of this.#walkers) bodies.push(walker)
    for (const walker of this.#escort.bodies) bodies.push(walker)
    return bodies
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
    this.#street.delete(walker.id)
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
      const route = this.#router.route(from, target)
      if (!route) continue
      walker.follow(route)
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
   * serial alone, so the same city crowds the same way every time. A spot
   * somebody is already standing in is refused and the stream carries on, so
   * the next attempt draws somewhere else rather than the same doorway.
   */
  #spawn(viewer: Point): boolean {
    const serial = this.#serial
    const rng = (this.#pending ??= this.#rng.fork(`walker/${serial}`))
    const cell = this.#pavement.pick(viewer, this.options.spawnNear, this.options.spawnFar, rng)
    if (!cell || !this.#nav.walkable(cell)) return false
    // nobody is born standing inside somebody else, and the stream carries on, so the next try is somewhere else
    const at = this.#ground.centreOf(cell)
    if (!this.#space.clear(at.x, at.z)) return false
    // nobody is on the street twice at once either, whoever the game draws its people from
    const npc = this.#people.street(serial, rng)
    if (!npc || this.#street.has(npc.id) || this.#escort.person(npc.id)) return false

    const spread = this.options.speedSpread
    const walker = new Walker({
      id: npc.id,
      actor: this.#cast.spawn(npc),
      ground: this.#ground,
      space: this.#space,
      kerb: this.#kerb,
      at,
      speed: METRICS.player.walkSpeed * rng.range(1 - spread, 1 + spread),
      turnRate: this.options.turnRate,
      stuckSeconds: this.options.stuckSeconds,
      rng,
      pauseMin: this.options.pauseMin,
      pauseMax: this.options.pauseMax,
    })
    this.#walkers.push(walker)
    this.#street.set(npc.id, npc)
    this.#space.add(walker)
    this.#pending = undefined
    this.#serial++
    return true
  }
}
