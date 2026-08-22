import type { Ground } from './ground.ts'
import type { CrowdOptions } from './options.ts'
import type { Hazard, Hazards } from './ports.ts'

/**
 * Nothing on a city street closes faster than this, in metres per second. It
 * only sizes the question asked of `Hazards`, never the answer.
 */
const FAST = 20

/**
 * Look before you step off the kerb. A walker leaving the pavement asks what
 * is moving on the road it is about to enter and holds if anything would reach
 * the spot it is stepping into before it is out of the way. Once it is in the
 * road it keeps going: this is looking both ways, not a crossing light.
 *
 * With no `Hazards` given the answer is always yes, so a city with no traffic
 * in it walks exactly as it did before.
 */
export class Kerb {
  #ground: Ground
  #hazards: Hazards | undefined
  #look: number
  #crawl: number
  #room: number

  constructor(ground: Ground, options: CrowdOptions, hazards: Hazards | undefined) {
    this.#ground = ground
    this.#hazards = hazards
    this.#look = options.kerbLook
    this.#crawl = options.hazardSpeed
    this.#room = options.personalSpace
  }

  /** True when a body standing at (x, z) may step to (toX, toZ) without stepping in front of anything. */
  safe(x: number, z: number, toX: number, toZ: number): boolean {
    if (!this.#hazards) return true
    // only leaving the pavement is a decision; once in the road, get across
    if (!this.#ground.pavement(x, z) || this.#ground.pavement(toX, toZ)) return true
    for (const hazard of this.#hazards.near(toX, toZ, this.#look * FAST)) {
      // something stopped is not coming, and a walker waiting for it would wait for ever
      if (Math.hypot(hazard.vx, hazard.vz) < this.#crawl) continue
      if (this.#reaches(hazard, toX, toZ)) return false
    }
    return true
  }

  /** How close this hazard comes to a point in the seconds a walker looks ahead, against the room it needs. */
  #reaches(hazard: Hazard, x: number, z: number): boolean {
    const dx = hazard.x - x
    const dz = hazard.z - z
    const speedSq = hazard.vx * hazard.vx + hazard.vz * hazard.vz
    const when = Math.min(Math.max(-(dx * hazard.vx + dz * hazard.vz) / speedSq, 0), this.#look)
    return Math.hypot(dx + hazard.vx * when, dz + hazard.vz * when) < hazard.radius + this.#room
  }
}
