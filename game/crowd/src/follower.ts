import { CLIPS } from '@gb/cast'
import { METRICS } from '@gb/world'
import { distance } from './geometry.ts'
import type { Ground } from './ground.ts'
import type { CrowdOptions } from './options.ts'
import type { CrowdNav, Point, WalkerView } from './ports.ts'
import type { Space } from './space.ts'
import type { Walker } from './walker.ts'

/** Close enough to the spot beside the player to stand there, in metres. */
const SETTLED = 0.6

/** How often a companion is allowed to work out a new way to the player, in seconds. */
const RETHINK = 0.35

/** How far the spot has to move before it is worth rethinking, in metres. */
const MOVED = 1.5

/** How far apart the line to the player is checked for walls, as a share of a cell. */
const SAMPLE = 0.5

/**
 * Somebody walking with the player. It is a `Walker` underneath, with the same
 * routes, the same avoidance and the same looking before crossing: what this
 * adds is where they are going, which is wherever the player is, and how fast
 * they have to move to stay there.
 *
 * Keeping up has three gears. Inside `catchUp` they walk. Past it they break
 * into a jog, up to the player's own running speed, which is enough to make up
 * ground round a corner. Past `lostRadius` they are put back beside the player:
 * that is a last resort for somebody who has been left the other side of the
 * city, not a way of following.
 */
export class Follower {
  readonly npcId: string
  readonly walker: Walker
  #nav: CrowdNav
  #ground: Ground
  #space: Space
  #options: CrowdOptions
  #owned: boolean
  #since = RETHINK
  #target: Point
  #standing = false

  constructor(
    npcId: string,
    walker: Walker,
    deps: { nav: CrowdNav; ground: Ground; space: Space; options: CrowdOptions; owned: boolean },
  ) {
    this.npcId = npcId
    this.walker = walker
    this.#nav = deps.nav
    this.#ground = deps.ground
    this.#space = deps.space
    this.#options = deps.options
    this.#owned = deps.owned
    this.#target = { x: walker.x, z: walker.z }
  }

  view(): WalkerView {
    return this.walker.view()
  }

  /** Let go of the body, but only if we were the ones who asked for it. */
  release(): void {
    if (this.#owned) this.walker.release()
    else this.walker.retire()
  }

  /** Nowhere to be sent this frame: stand where we are. */
  hold(seconds: number): void {
    if (!this.walker.attending) this.#stand()
    this.walker.advance(seconds)
  }

  /** One frame of keeping up with the spot the crowd has picked out for us. */
  advance(seconds: number, slot: Point): void {
    this.#since += seconds
    // being talked to comes first: they stand and face whoever it is, and catch up after
    if (this.walker.attending) {
      this.walker.advance(seconds)
      return
    }

    const gap = distance(this.walker.x, this.walker.z, slot.x, slot.z)
    if (gap > this.#options.lostRadius) {
      // left behind the other side of the city: appear beside them rather than jog for a minute
      this.walker.putAt(slot.x, slot.z)
      this.#standing = true
      this.walker.advance(seconds)
      return
    }

    this.walker.speed = this.#gearFor(gap)
    this.walker.moving = gap > this.#options.catchUp ? CLIPS.run : CLIPS.walk
    if (gap <= SETTLED) this.#stand()
    else if (this.#rethinking(slot)) this.#makeFor(slot)
    this.walker.advance(seconds)
  }

  /** Walking pace up close, working up to a run the further behind we are. */
  #gearFor(gap: number): number {
    const walk = METRICS.player.walkSpeed
    if (gap <= this.#options.catchUp) return walk
    const behind = (gap - this.#options.catchUp) / Math.max(this.#options.lostRadius - this.#options.catchUp, 1)
    return walk + (METRICS.player.runSpeed - walk) * Math.min(behind, 1)
  }

  #stand(): void {
    if (this.#standing) return
    this.#standing = true
    this.walker.follow([])
  }

  #rethinking(slot: Point): boolean {
    if (this.#since < RETHINK) return false
    if (this.#standing || this.walker.state === 'idle') return true
    return distance(this.#target.x, this.#target.z, slot.x, slot.z) > MOVED
  }

  /** Straight there when the way is clear, and round the houses through `@gb/nav` when it is not. */
  #makeFor(slot: Point): void {
    this.#since = 0
    this.#standing = false
    this.#target = { x: slot.x, z: slot.z }
    if (this.#clearTo(slot)) {
      this.walker.follow([slot])
      return
    }
    const path = this.#nav.path(this.#ground.cellAt(this.walker.x, this.walker.z), this.#ground.cellAt(slot.x, slot.z))
    if (path) {
      this.walker.follow(this.#nav.waypoints(path))
      return
    }
    // out of town there are no routes to ask for: walk at them and slide around whatever is in the way
    if (!this.#ground.holds(slot.x, slot.z)) this.walker.follow([slot])
  }

  /** True when nothing stands between us and the spot, so no route is needed to walk to it. */
  #clearTo(slot: Point): boolean {
    const dx = slot.x - this.walker.x
    const dz = slot.z - this.walker.z
    const span = Math.hypot(dx, dz)
    const steps = Math.ceil(span / (this.#ground.cellSize * SAMPLE))
    for (let i = 1; i <= steps; i++) {
      const at = i / steps
      if (!this.#space.free(this.walker.x + dx * at, this.walker.z + dz * at)) return false
    }
    return true
  }
}
