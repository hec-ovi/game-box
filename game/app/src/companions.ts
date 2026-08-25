import type { PlayerState } from '@gb/play'
import type { Npc, World } from '@gb/world'
import type { Buildings } from './buildings.ts'
import type { SetOff, Street } from './street.ts'
import type { Vec2 } from './walk.ts'

/**
 * Who is walking with the player. `@gb/play` holds the list, and it is written
 * three ways: a click on somebody in reach, a conversation in which they agree
 * to come along, and a job that puts them beside the player. The bodies follow
 * the list rather than any one of those: whoever is on it and not yet walking
 * sets off, from the pavement they are standing on or the doorstep of the
 * building they were stationed in, and whoever is walking and no longer on it
 * goes back to their post. So nobody is ever in two places at once, and no way
 * of agreeing leaves a flag with no body behind it.
 */
export class Companions {
  #world: World
  #player: PlayerState
  #street: Street
  #buildings: Buildings
  #riding: () => readonly string[]
  #note: (text: string) => void

  constructor(input: {
    world: World
    player: PlayerState
    street: Street
    buildings: Buildings
    /** Whoever is in the player's car: with the player, and not on the pavement to be counted. */
    riding: () => readonly string[]
    note: (text: string) => void
  }) {
    this.#world = input.world
    this.#player = input.player
    this.#street = input.street
    this.#buildings = input.buildings
    this.#riding = input.riding
    this.#note = input.note
  }

  /** Ask somebody along, or tell them to stay where they are. */
  toggle(npcId: string): void {
    const npc = this.#world.npc(npcId)
    if (!npc || !this.#street.walkable) return

    if (this.#player.isCompanion(npcId)) {
      this.#player.removeCompanion(npcId)
      this.#note(`${npc.name} stays here`)
    } else {
      this.#player.addCompanion(npcId)
      this.#note(`${npc.name} comes with you`)
    }
    this.sync()
  }

  /**
   * Bring the bodies in line with the list. Somebody who agreed in a
   * conversation or was put beside the player by a job sets off; somebody the
   * job or the conversation sent home goes back to their post.
   */
  sync(): void {
    if (!this.#street.walkable) return
    const listed = new Set(this.#player.companions())
    const walking = new Set([...this.#street.following().map((person) => person.id), ...this.#riding()])
    for (const npcId of walking) if (!listed.has(npcId)) this.#stay(npcId)
    for (const npcId of listed) if (!walking.has(npcId)) this.#setOff(npcId)
  }

  /**
   * Everybody still walking with the player, put back beside them. Two moments
   * want it: coming out of a building, where they waited by the door rather
   * than where they were standing when it closed, and opening the game again,
   * where the save says who is with the player but the city has just put them
   * back at their own post across town.
   */
  regroup(at: Vec2): void {
    for (const npcId of this.#player.companions()) {
      const npc = this.#world.npc(npcId)
      if (!npc) continue
      this.#street.stopFollowing(npcId)
      this.#street.follow(npc, { at })
      // and they are not also standing at their anchor, which is where a
      // freshly built room draws them
      this.#buildings.showPerson(npcId, false)
    }
  }

  /**
   * They step off from where they are standing: their own spot on the
   * pavement, or the doorstep of the building they were stationed in. Handed
   * the player's own spot instead, somebody across the street teleports to
   * them and somebody behind a counter appears on the pavement outside.
   */
  #setOff(npcId: string): void {
    const npc = this.#world.npc(npcId)
    if (!npc) return
    this.#street.follow(npc, from(npc, this.#world, this.#street))
    this.#buildings.showPerson(npcId, false)
  }

  #stay(npcId: string): void {
    this.#street.stopFollowing(npcId)
    this.#buildings.showPerson(npcId, true)
  }
}

/** Where somebody sets off from: the pavement they are on, the door of the room they were in, or beside the player. */
function from(npc: Npc, world: World, street: Street): SetOff {
  const standing = street.walkers().find((walker) => walker.id === npc.id)
  if (standing) return { at: { x: standing.x, z: standing.z } }
  const plotId = npc.station ? world.interior(npc.station.interiorId)?.plotId : undefined
  return plotId ? { door: plotId } : {}
}
