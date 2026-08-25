import { walkFor } from '@gb/cast'
import { METRICS, type Npc } from '@gb/world'
import type { Rng } from '@gb/kit'
import { Follower } from './follower.ts'
import type { Ground } from './ground.ts'
import type { Kerb } from './kerb.ts'
import type { CrowdOptions } from './options.ts'
import type { Places } from './places.ts'
import type { Companion, CrowdCast, CrowdNav, Point, WalkerView } from './ports.ts'
import type { Body, Space } from './space.ts'
import { Walker } from './walker.ts'

/** Where companions stand relative to the way the player is going: behind, then fanned out either side. */
const FAN = [0, 0.6, -0.6, 1.2, -1.2]

/** Below this the player is standing still rather than going somewhere, in metres per second. */
const STROLLING = 0.2

export interface EscortDeps {
  readonly nav: CrowdNav
  readonly ground: Ground
  readonly space: Space
  readonly kerb: Kerb
  readonly cast: CrowdCast
  readonly places: Places
  readonly options: CrowdOptions
  readonly rng: Rng
}

/**
 * The people walking with the player: who they are, where each of them ought
 * to be, and keeping them there. The spot is behind the way the player is
 * going, fanned out so a party of them does not walk in one pair of shoes, and
 * it holds its bearing when the player stops so nobody circles round them.
 */
export class Escort {
  #deps: EscortDeps
  #followers: Follower[] = []
  /** Who each companion is, so the game can read them back off the id their view carries. */
  #people = new Map<string, Npc>()
  /** The same people as bodies, kept in step so reading them every frame allocates nothing. */
  #bodies: Walker[] = []
  #wayX = 0
  #wayZ = 1
  #slot = { x: 0, z: 0 }

  constructor(deps: EscortDeps) {
    this.#deps = deps
  }

  /** The bodies, for anything that has to keep out of them. */
  get bodies(): readonly Walker[] {
    return this.#bodies
  }

  list(): readonly WalkerView[] {
    return this.#followers.map((follower) => follower.view())
  }

  /** The person walking with the player under this id, if it is one of ours. */
  person(npcId: string): Npc | undefined {
    return this.#people.get(npcId)
  }

  /** The body behind one of them, for anything that has to hold them still. */
  walker(npcId: string): Walker | undefined {
    return this.#followers.find((follower) => follower.npcId === npcId)?.walker
  }

  /** Somebody comes along. Following twice is following once. */
  follow(who: Companion): void {
    this.stop(who.npc.id)
    const { options } = this.#deps
    const walker = new Walker({
      id: who.npc.id,
      actor: who.actor ?? this.#deps.cast.spawn(who.npc),
      ground: this.#deps.ground,
      space: this.#deps.space,
      kerb: this.#deps.kerb,
      at: who.at ?? this.#setsOff(who.door),
      speed: METRICS.player.walkSpeed,
      walk: walkFor(who.npc.id),
      turnRate: options.turnRate,
      stuckSeconds: options.stuckSeconds,
      rng: this.#deps.rng.fork(`companion/${who.npc.id}`),
      pauseMin: 0,
      pauseMax: 0,
      dwellMin: 0,
      dwellMax: 0,
      talkRadius: options.talkRadius,
      // the spot beside the player is a spot, and is stood on
      arrival: 0.3,
      // they follow the player rather than the crossings, so talking to one stops them where they stand
      finishesCrossings: false,
    })
    this.#followers.push(new Follower(who.npc.id, walker, { ...this.#deps, owned: !who.actor }))
    this.#bodies.push(walker)
    this.#people.set(who.npc.id, who.npc)
  }

  /** The doorstep of the building they are coming out of, or where the player is when there is no such door. */
  #setsOff(door: string | undefined): Point {
    const cell = door === undefined ? undefined : this.#deps.places.doorstep(door)
    if (cell) return this.#deps.ground.centreOf(cell)
    return { x: this.#deps.space.viewer.x, z: this.#deps.space.viewer.z }
  }

  /** A body the crowd spawned goes back to the cast; one the game handed over is left alone. */
  stop(npcId: string): void {
    const index = this.#followers.findIndex((follower) => follower.npcId === npcId)
    if (index === -1) return
    this.#followers.splice(index, 1)[0]!.release()
    this.#bodies.splice(index, 1)
    this.#people.delete(npcId)
  }

  clear(): void {
    for (const follower of this.#followers) follower.release()
    this.#followers.length = 0
    this.#bodies.length = 0
    this.#people.clear()
  }

  /** One frame: everybody to their own spot, and whoever has none stands still. */
  advance(seconds: number, player: Body): void {
    if (this.#followers.length === 0) return
    const pace = Math.hypot(player.vx, player.vz)
    if (pace > STROLLING) {
      this.#wayX = player.vx / pace
      this.#wayZ = player.vz / pace
    }
    for (let i = 0; i < this.#followers.length; i++) {
      const spot = this.#spotFor(i, player)
      if (spot) this.#followers[i]!.advance(seconds, spot)
      else this.#followers[i]!.hold(seconds)
    }
  }

  /**
   * Behind the player, fanned out, and moved along the fan if that spot is
   * inside a wall or under a car. Nowhere in the fan is open, nobody is
   * placed: standing still is a companion waiting a moment, and standing on
   * the player is a companion inside their head.
   */
  #spotFor(index: number, player: Body): Point | undefined {
    const gap = this.#deps.options.followGap
    for (let turn = 0; turn < FAN.length; turn++) {
      const angle = FAN[(index + turn) % FAN.length]!
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      this.#slot.x = player.x - (this.#wayX * cos - this.#wayZ * sin) * gap
      this.#slot.z = player.z - (this.#wayX * sin + this.#wayZ * cos) * gap
      if (this.#deps.space.free(this.#slot.x, this.#slot.z)) return this.#slot
    }
    return undefined
  }
}
