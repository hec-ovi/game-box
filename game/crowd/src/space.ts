import { METRICS } from '@gb/world'
import type { Ground } from './ground.ts'
import { Obstacles, type Edge, type Solid } from './obstacles.ts'
import type { CrowdOptions } from './options.ts'
import type { CrowdNav, Point } from './ports.ts'

/** Anything that takes up room on the pavement: a walker, or the person playing. */
export interface Body {
  readonly x: number
  readonly z: number
  /** How it is moving, in metres per second. Zero for somebody standing still. */
  readonly vx: number
  readonly vz: number
}

/** A body that can be moved by the room it is in: shoved out of a car it is standing inside. */
export interface Mover {
  x: number
  z: number
}

/** What the crowd is asking of a body this frame. The caller owns it, so a frame allocates nothing. */
export interface Urge {
  /** Which way to lean, added to the pull of the route. */
  x: number
  z: number
  /** How much of the step to take: 1 walks on, 0 stands still. */
  pace: number
  /** Which side a car in the way is being passed on, 1 for the right and -1 for the left, kept frame to frame so the choice is made once. 0 when none is. */
  side: number
}

/** Walking pace, the speed the comfort distance is measured against. */
const WALK = METRICS.player.walkSpeed

/** How much of the lean is sideways when somebody is coming at us: enough to pick a side and commit. */
const SIDESTEP = 0.9

/** How much in front somebody has to be before we pass them on our right rather than only lean away. */
const HEAD_ON = 0.3

/** How much in front somebody has to be before we slow for them instead of going round. */
const FRONT = 0.7

/** Room wanted beyond arm's length even at a standstill, in metres, so people are not steered by the hard floor. */
const BUBBLE = 0.5

/** Extra room wanted per metre per second of closing speed. People give a stranger at speed more room. */
const COMFORT = 0.5

/** Metres of room, beyond the room we want, over which we come to a stop behind somebody. */
const BRAKE = 1.5

/** The slowest we go for anybody we are not queued behind, so squeezing past is slow, never stuck. */
const SQUEEZE = 0.35

/** How fast somebody is shoved out of a car that has arrived on top of them, in metres per second. */
const SHOVE = 3

/** Within this of straight ahead, a car is dead ahead and the side to pass it on is a choice rather than a reading. */
const DEAD_AHEAD = 0.1

/**
 * The room a walker has: who is standing next to it and where the ground takes
 * feet. Bodies are bucketed once a frame, so keeping thirty people out of each
 * other costs a handful of lookups each rather than comparing everybody to
 * everybody.
 */
export class Space {
  #ground: Ground
  #nav: CrowdNav
  #obstacles: Obstacles
  #personal: number
  #reach: number
  #strength: number
  #ahead: number
  #bucket: number
  #buckets = new Map<number, Body[]>()
  #spare: Body[][] = []
  #used = 0
  /** The player, as one more body. Their velocity is worked out here, because they are handed over as a bare point. */
  #viewer: Watched = { x: 0, z: 0, vx: 0, vz: 0 }
  /** Who is near, and who they are near. Worked out once per body per frame and reused, and it allocates nothing. */
  #near: Body[] = []
  #focus: Body | undefined
  /** One cell handed to nav and never kept, because this is asked of every step. */
  #asked = { x: 0, y: 0 }
  /** The nearest point of a car's outline. Reused, so a frame allocates nothing. */
  #edge: Edge = { x: 0, z: 0, away: 0 }

  constructor(ground: Ground, nav: CrowdNav, options: CrowdOptions, obstacles: Obstacles) {
    this.#ground = ground
    this.#nav = nav
    this.#obstacles = obstacles
    this.#personal = options.personalSpace
    this.#reach = options.avoidRadius
    this.#strength = options.avoidStrength
    this.#ahead = options.anticipate
    // a body can move this far between two frames, so the buckets are a step wider than the reach
    const fastest = METRICS.player.walkSpeed * (1 + options.speedSpread)
    this.#bucket = options.avoidRadius + fastest * options.maxStep
  }

  /** Where everybody stands this frame. Bodies are held by reference, so one that moves stays current. */
  begin(bodies: readonly Body[], viewer: Point, seconds: number): void {
    for (let i = 0; i < this.#used; i++) this.#spare[i]!.length = 0
    this.#buckets.clear()
    this.#used = 0
    this.#focus = undefined
    this.#watch(viewer, seconds)
    this.#obstacles.begin(viewer)
    for (const body of bodies) this.add(body)
  }

  /** The player, as the crowd sees them: where they are standing and how fast they got there. */
  get viewer(): Body {
    return this.#viewer
  }

  /** A body that appeared after `begin`, so the next one to spawn can see it. */
  add(body: Body): void {
    this.#bucketAt(body.x, body.z).push(body)
    this.#focus = undefined
  }

  /**
   * True when a body may stand here: inside the city, not in a building, a
   * mountain or water; outside it, wherever the ground the game gave us takes
   * feet. Without a ground source the city is all there is.
   */
  open(x: number, z: number): boolean {
    if (!this.#ground.holds(x, z)) return this.#ground.outside(x, z)
    const cell = this.#asked
    cell.x = Math.floor(x / this.#ground.cellSize)
    cell.y = Math.floor(z / this.#ground.cellSize)
    return this.#nav.walkable(cell)
  }

  /** True when a body may stand here and no car is parked over it: `open`, and clear of every outline on the road. */
  free(x: number, z: number): boolean {
    if (!this.open(x, z)) return false
    for (const solid of this.#obstacles.at(x, z)) {
      Obstacles.edge(solid, x, z, this.#edge)
      if (this.#edge.away < this.#personal) return false
    }
    return true
  }

  /** True when nobody is standing within personal space of this point and nothing is parked over it. Used before putting somebody new on the street. */
  clear(x: number, z: number): boolean {
    if (!this.free(x, z)) return false
    this.#fill(x, z, undefined)
    this.#focus = undefined
    return this.#closest(this.#near, x, z) >= this.#personal
  }

  /**
   * Somebody a car has arrived on top of is shoved out through its nearest
   * side, onto ground they may stand on, at a shove's pace rather than in one
   * jump. Nothing else ever moves a body but its own feet.
   */
  eject(body: Mover, seconds: number): void {
    for (const solid of this.#obstacles.around(body)) {
      Obstacles.edge(solid, body.x, body.z, this.#edge)
      if (this.#edge.away >= 0) continue
      const dx = this.#edge.x - body.x
      const dz = this.#edge.z - body.z
      const toSide = Math.hypot(dx, dz)
      if (toSide < 1e-9) continue
      const push = Math.min(toSide + this.#personal, SHOVE * seconds)
      const x = body.x + (dx / toSide) * push
      const z = body.z + (dz / toSide) * push
      if (!this.open(x, z)) continue
      body.x = x
      body.z = z
    }
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
    // the same rule against the side of a car: never closer than arm's length, and out is the only way from inside
    for (const solid of this.#obstacles.around(self)) {
      Obstacles.edge(solid, x, z, this.#edge)
      const after = this.#edge.away
      if (after >= this.#personal) continue
      Obstacles.edge(solid, self.x, self.z, this.#edge)
      if (after < this.#edge.away) return false
    }
    return true
  }

  /**
   * What a body wanting to walk `forward` at `speed` should do about everybody
   * else. It leans away from where it would meet them rather than from where
   * they are now, so two people on courses that cross ease apart early and by
   * a little instead of late and by a lot. Somebody coming the other way is
   * passed on the right, the same side every time. Somebody in the way that
   * leaning will not clear is not barged: the pace drops, which is what turns
   * a narrow pavement into a queue rather than a scrum.
   */
  steer(self: Body, forwardX: number, forwardZ: number, speed: number, out: Urge): void {
    out.x = 0
    out.z = 0
    out.pace = 1
    const myX = forwardX * speed
    const myZ = forwardZ * speed

    for (const other of this.#around(self)) {
      const rx = other.x - self.x
      const rz = other.z - self.z
      this.#avoid(forwardX, forwardZ, myX, myZ, rx, rz, Math.hypot(rx, rz), other, out)
    }
    if (!this.#obstacles.any) return
    const chosen = out.side
    out.side = 0
    for (const solid of this.#obstacles.around(self)) this.#skirt(self, forwardX, forwardZ, solid, chosen, out)
  }

  /**
   * A car is walked round rather than leant away from. The way becomes the
   * tangent that clears its nearest side by arm's length and a bit, on the
   * side we are already on, and stays that until the side is behind us, so a
   * route that runs through a stopped car is walked round it, never dithered
   * at. The side is chosen once: somebody straight in front of a car would
   * otherwise find it on their left one frame and their right the next.
   * Somebody inside one is being shoved out and is not steered at all.
   */
  #skirt(self: Body, forwardX: number, forwardZ: number, solid: Solid, chosen: number, out: Urge): void {
    Obstacles.edge(solid, self.x, self.z, this.#edge)
    const gap = this.#edge.away
    if (gap < 0 || gap >= this.#reach) return
    const rx = this.#edge.x - self.x
    const rz = this.#edge.z - self.z
    // behind us or level with us is past
    if (rx * forwardX + rz * forwardZ <= 0) return
    const cross = rx * forwardZ - rz * forwardX
    const room = this.#personal + BUBBLE
    if (Math.abs(cross) >= room) return

    const ux = rx / gap
    const uz = rz / gap
    // the tangent that carries us forward. Straight at it neither does, and then it is the side
    // already chosen, else the right, the side we pass people on
    let px = -uz
    let pz = ux
    const onward = px * forwardX + pz * forwardZ
    const right = Math.abs(onward) > DEAD_AHEAD ? onward > 0 : chosen !== 0 ? chosen > 0 : true
    out.side = right ? 1 : -1
    if (!right) {
      px = -px
      pz = -pz
    }
    let tx = px
    let tz = pz
    if (gap > room) {
      // outside the room we want: aim past it rather than along it
      const sin = room / gap
      const cos = Math.sqrt(1 - sin * sin)
      tx = ux * cos + px * sin
      tz = uz * cos + pz * sin
    }
    out.x += tx - forwardX
    out.z += tz - forwardZ
  }

  /** One person to keep clear of, `gap` metres off along (rx, rz), moving as `other` moves. */
  #avoid(
    forwardX: number,
    forwardZ: number,
    myX: number,
    myZ: number,
    rx: number,
    rz: number,
    gap: number,
    other: Body,
    out: Urge,
  ): void {
    if (gap >= this.#reach) return

    // where they end up relative to us when we are at our closest, inside the time we look ahead
    const vx = other.vx - myX
    const vz = other.vz - myZ
    const closingSq = vx * vx + vz * vz
    const when = closingSq > 1e-9 ? clamp(-(rx * vx + rz * vz) / closingSq, 0, this.#ahead) : 0
    const missX = rx + vx * when
    const missZ = rz + vz * when
    const miss = Math.hypot(missX, missZ)
    // the room we want grows with how fast we are closing: at a standstill it is arm's length
    const want = this.#personal + BUBBLE + COMFORT * (Math.sqrt(closingSq) / WALK)
    if (miss >= want) return

    // in front of us, and going our way rather than coming at us or standing in it
    const infront = gap > 1e-6 ? (rx * forwardX + rz * forwardZ) / gap : 1
    const theirs = Math.hypot(other.vx, other.vz)
    const alongside = theirs > 1e-3 && (other.vx * forwardX + other.vz * forwardZ) / theirs > FRONT
    if (infront > FRONT && gap > want) {
      // queue behind somebody walking our way; only ease off for anybody else, so nothing comes to a standstill
      const slow = clamp((gap - want) / BRAKE, 0, 1)
      out.pace = Math.min(out.pace, alongside ? slow : Math.max(slow, SQUEEZE))
    }

    // lean away from where we would meet them; two bodies in one spot have no such point, so they step aside
    let awayX = -forwardZ
    let awayZ = forwardX
    if (miss > 1e-6) {
      awayX = -missX / miss
      awayZ = -missZ / miss
    } else if (gap > 1e-6) {
      awayX = -rx / gap
      awayZ = -rz / gap
    }
    // sideways only. Backing off along the route is what `pace` is for, and a lean that fought the route
    // would have a walker reversing away from somebody walking at it
    const along = awayX * forwardX + awayZ * forwardZ
    awayX -= forwardX * along
    awayZ -= forwardZ * along

    const lean = this.#strength * (1 - when / this.#ahead) * (1 - miss / want)
    out.x += awayX * lean
    out.z += awayZ * lean
    if (infront <= HEAD_ON) return
    out.x += -forwardZ * lean * SIDESTEP
    out.z += forwardX * lean * SIDESTEP
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

  /** The player is handed over as a bare point, so their speed is whatever moved them since the last frame. */
  #watch(viewer: Point, seconds: number): void {
    const watched = this.#viewer
    if (seconds > 0) {
      watched.vx = (viewer.x - watched.x) / seconds
      watched.vz = (viewer.z - watched.z) / seconds
    }
    watched.x = viewer.x
    watched.z = viewer.z
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

/** The player as a body: where they are, and how fast they got there. */
interface Watched {
  x: number
  z: number
  vx: number
  vz: number
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

/**
 * One number per bucket. Two far-apart buckets may land on the same number;
 * every scan measures the real distance anyway, so a clash costs a comparison
 * and nothing else.
 */
function key(x: number, z: number): number {
  return (x * 73856093) ^ (z * 19349663)
}
