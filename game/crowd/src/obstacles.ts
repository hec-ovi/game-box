import { METRICS } from '@gb/world'
import type { CrowdOptions } from './options.ts'
import type { Hazards, Point } from './ports.ts'

/** The nearest point of a solid's outline to somewhere, and how far off it is: negative when inside. */
export interface Edge {
  x: number
  z: number
  away: number
}

/**
 * One thing on the road, read off a `Hazard` once a frame with its axis
 * worked out, so every walker that measures itself against it pays no trig.
 * A box when the hazard has a footprint, else the circle its radius draws.
 * Where it is going is not kept: a walker walks round where a car is, and
 * whether to step out in front of one is the kerb's question, asked of the
 * port itself.
 */
export interface Solid {
  x: number
  z: number
  /** Along its length, a unit vector. */
  ax: number
  az: number
  halfLength: number
  halfWidth: number
  /** Nothing to measure but the radius. */
  round: boolean
  radius: number
}

/** Room past the edge of town the index still reaches, in metres, so a car half over the line is not missed. */
const MARGIN = 10

/**
 * What is on the roads this frame, bucketed once so every walker finds the
 * cars beside it in one look at its own neighbourhood. The port is asked once
 * a frame for everything near the player, which is where every walker is, so
 * the cost of reading the traffic grows with the traffic and the cost of
 * keeping out of it grows with the crowd, never with the two multiplied.
 */
export class Obstacles {
  #hazards: Hazards | undefined
  #range: number
  /** How far a scan has to reach: the avoid radius and a step. The bucket is that plus the widest thing on the road this frame. */
  #reach: number
  #bucket: number
  #buckets = new Map<number, Solid[]>()
  #spare: Solid[][] = []
  #used = 0
  /** Solids are reused frame to frame, so reading the road allocates nothing once it has been read once. */
  #solids: Solid[] = []
  #count = 0
  /** Who is near, worked out once per body per frame and reused. Allocates nothing. */
  #near: Solid[] = []
  #focus: Point | undefined

  constructor(options: CrowdOptions, hazards: Hazards | undefined) {
    this.#hazards = hazards
    const fastest = METRICS.player.walkSpeed * (1 + options.speedSpread)
    this.#reach = options.avoidRadius + fastest * options.maxStep
    this.#bucket = this.#reach
    this.#range = Math.max(options.retireRadius, options.lostRadius) + this.#reach + MARGIN
  }

  /** False with no traffic to read: nothing here is worth asking. */
  get any(): boolean {
    return this.#hazards !== undefined
  }

  /**
   * Read the road once for the frame: everything near the player, each in the
   * one bucket its centre falls in. The buckets are sized to the widest thing
   * out there plus the reach of a scan, so a scan of a body's neighbours finds
   * every outline within reach from any side.
   */
  begin(viewer: Point): void {
    for (let i = 0; i < this.#used; i++) this.#spare[i]!.length = 0
    this.#buckets.clear()
    this.#used = 0
    this.#count = 0
    this.#focus = undefined
    if (!this.#hazards) return
    let widest = 0
    for (const hazard of this.#hazards.near(viewer.x, viewer.z, this.#range)) {
      const solid = this.#solids[this.#count] ?? (this.#solids[this.#count] = blank())
      this.#count++
      solid.x = hazard.x
      solid.z = hazard.z
      solid.radius = hazard.radius
      const box = hazard.footprint
      solid.round = box === undefined
      let extent = hazard.radius
      if (box) {
        solid.ax = -Math.sin(box.heading)
        solid.az = -Math.cos(box.heading)
        solid.halfLength = box.length / 2
        solid.halfWidth = box.width / 2
        extent = Math.max(extent, Math.hypot(box.length, box.width) / 2)
      }
      widest = Math.max(widest, extent)
    }
    this.#bucket = this.#reach + widest
    for (let i = 0; i < this.#count; i++) {
      const solid = this.#solids[i]!
      this.#bucketAt(Math.floor(solid.x / this.#bucket), Math.floor(solid.z / this.#bucket)).push(solid)
    }
  }

  /**
   * Everything whose outline could be within reach of a body. One scan lasts
   * that body's whole frame: it reaches a step further than the avoid radius,
   * so it still holds after the body has taken that step.
   */
  around(body: Point): readonly Solid[] {
    if (this.#focus !== body) {
      this.#focus = body
      this.#fill(body.x, body.z)
    }
    return this.#near
  }

  /** The same for a bare point, asked once. */
  at(x: number, z: number): readonly Solid[] {
    this.#focus = undefined
    this.#fill(x, z)
    return this.#near
  }

  /**
   * The nearest point of a solid's outline to (x, z), written into `out` with
   * how far off it is. Inside the outline that distance is negative, and the
   * point is on the nearest side, which is the way out.
   */
  static edge(solid: Solid, x: number, z: number, out: Edge): void {
    const rx = x - solid.x
    const rz = z - solid.z
    if (solid.round) {
      const away = Math.hypot(rx, rz)
      const ux = away > 1e-9 ? rx / away : 1
      const uz = away > 1e-9 ? rz / away : 0
      out.x = solid.x + ux * solid.radius
      out.z = solid.z + uz * solid.radius
      out.away = away - solid.radius
      return
    }
    // along its length and across it, in its own frame
    const { ax, az, halfLength, halfWidth } = solid
    const bx = -az
    const bz = ax
    const along = rx * ax + rz * az
    const across = rx * bx + rz * bz
    const overL = Math.abs(along) - halfLength
    const overW = Math.abs(across) - halfWidth
    let l: number
    let w: number
    if (overL <= 0 && overW <= 0) {
      // inside: the nearest side is the one we are least deep behind
      if (overL > overW) {
        l = (Math.sign(along) || 1) * halfLength
        w = across
        out.away = overL
      } else {
        l = along
        w = (Math.sign(across) || 1) * halfWidth
        out.away = overW
      }
    } else {
      l = clamp(along, -halfLength, halfLength)
      w = clamp(across, -halfWidth, halfWidth)
      out.away = Math.hypot(Math.max(overL, 0), Math.max(overW, 0))
    }
    out.x = solid.x + ax * l + bx * w
    out.z = solid.z + az * l + bz * w
  }

  #fill(x: number, z: number): void {
    const found = this.#near
    found.length = 0
    if (this.#used === 0) return
    const bx = Math.floor(x / this.#bucket)
    const bz = Math.floor(z / this.#bucket)
    for (let ix = bx - 1; ix <= bx + 1; ix++) {
      for (let iz = bz - 1; iz <= bz + 1; iz++) {
        const bucket = this.#buckets.get(key(ix, iz))
        if (bucket) for (const solid of bucket) found.push(solid)
      }
    }
  }

  #bucketAt(ix: number, iz: number): Solid[] {
    const at = key(ix, iz)
    const held = this.#buckets.get(at)
    if (held) return held
    const list = this.#spare[this.#used] ?? (this.#spare[this.#used] = [])
    this.#used++
    this.#buckets.set(at, list)
    return list
  }
}

function blank(): Solid {
  return { x: 0, z: 0, ax: 0, az: 1, halfLength: 0, halfWidth: 0, round: true, radius: 0 }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

/** One number per bucket; a clash between far-apart buckets costs a comparison, because every scan measures the real distance. */
function key(x: number, z: number): number {
  return (x * 73856093) ^ (z * 19349663)
}
