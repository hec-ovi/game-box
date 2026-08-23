import { WIDEST_ROADWAY_CELLS } from '@gb/world'
import type { Ground } from './ground.ts'
import type { CrowdOptions } from './options.ts'
import type { Hazard, Hazards } from './ports.ts'

/**
 * Nothing on a city street closes faster than this, in metres per second. It
 * only sizes the question asked of `Hazards`, never the answer.
 */
const FAST = 20

/** How finely the road ahead is measured, as a fraction of a cell. */
const PROBE = 0.25

/**
 * Look before you step off the kerb. A walker leaving the pavement measures how
 * much road is in front of it, works out how long it will be out there, and
 * holds unless it can be across before anything moving reaches it. Once it is
 * in the road it keeps going: the decision at the kerb already covered the
 * whole way over, so a crossing is never abandoned half way.
 *
 * That is why the look is not one number. A 10 m street is seven seconds of
 * walking and a 14 m avenue is ten, and five of those ten are spent in the
 * oncoming half, which is a car's length of road every second at the speed an
 * avenue is driven at. So the walker is measured against where it will be when
 * each car arrives, not against the kerb it is standing on: a car in the far
 * lanes counts against the moment the walker gets to the far lanes.
 *
 * With no `Hazards` given the answer is always yes, so a city with no traffic
 * in it walks exactly as it did before.
 */
export class Kerb {
  #ground: Ground
  #hazards: Hazards | undefined
  #least: number
  #crawl: number
  #room: number
  /** No crossing is wider than the widest roadway there is, so the probe stops there. */
  #reach: number

  constructor(ground: Ground, options: CrowdOptions, hazards: Hazards | undefined) {
    this.#ground = ground
    this.#hazards = hazards
    this.#least = options.kerbLook
    this.#crawl = options.hazardSpeed
    this.#room = options.personalSpace
    this.#reach = WIDEST_ROADWAY_CELLS * ground.cellSize
  }

  /**
   * True when a body standing at (x, z) walking at `speed` may step to
   * (toX, toZ) without stepping in front of anything.
   */
  safe(x: number, z: number, toX: number, toZ: number, speed: number): boolean {
    if (!this.#hazards) return true
    // only leaving the pavement is a decision; once in the road, get across
    if (!this.#ground.pavement(x, z) || this.#ground.pavement(toX, toZ)) return true

    const way = direction(x, z, toX, toZ)
    const look = Math.max(this.#least, this.#across(x, z, way) / Math.max(speed, 0.1))
    for (const hazard of this.#hazards.near(x, z, this.#reach + look * FAST)) {
      // something stopped is not coming, and a walker waiting for it would wait for ever
      if (Math.hypot(hazard.vx, hazard.vz) < this.#crawl) continue
      if (this.#meets(hazard, x, z, way, speed, look)) return false
    }
    return true
  }

  /**
   * How much roadway lies ahead of this kerb along the way the walker is
   * stepping, in metres: as far as the road goes, which is how long the walker
   * will be out on it. No crossing is wider than the widest class of road, so
   * that is where the probe stops looking.
   */
  #across(x: number, z: number, way: { x: number; z: number }): number {
    const step = this.#ground.cellSize * PROBE
    for (let at = step / 2; at <= this.#reach; at += step) {
      const ahead = this.#ground.cellAt(x + way.x * at, z + way.z * at)
      if (!this.#ground.roadway(ahead)) return at
    }
    return this.#reach
  }

  /**
   * How close this hazard comes to the walker while the walker is crossing.
   * Both are moving, so it is the nearest the two get over the look, which is
   * what makes the far lanes count for when the walker will be in them rather
   * than for where it is standing now.
   */
  #meets(
    hazard: Hazard,
    x: number,
    z: number,
    way: { x: number; z: number },
    speed: number,
    look: number,
  ): boolean {
    const dx = hazard.x - x
    const dz = hazard.z - z
    const vx = hazard.vx - way.x * speed
    const vz = hazard.vz - way.z * speed
    const closing = vx * vx + vz * vz
    const when = closing === 0 ? 0 : Math.min(Math.max(-(dx * vx + dz * vz) / closing, 0), look)
    return Math.hypot(dx + vx * when, dz + vz * when) < hazard.radius + this.#room
  }
}

/** The way a step points, or straight ahead when it is no step at all. */
function direction(x: number, z: number, toX: number, toZ: number): { x: number; z: number } {
  const dx = toX - x
  const dz = toZ - z
  const length = Math.hypot(dx, dz)
  return length === 0 ? { x: 0, z: 1 } : { x: dx / length, z: dz / length }
}
