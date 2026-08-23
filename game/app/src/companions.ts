import type { PlayerState } from '@gb/play'
import type { World } from '@gb/world'
import type { Buildings } from './buildings.ts'
import type { Street } from './street.ts'
import type { Vec2 } from './walk.ts'

/**
 * Who is walking with the player. Asking somebody along takes them off their
 * anchor, and telling them to stay puts them back on it, so nobody is ever in
 * two places at once.
 */
export class Companions {
  #world: World
  #player: PlayerState
  #street: Street
  #buildings: Buildings
  #note: (text: string) => void

  constructor(input: {
    world: World
    player: PlayerState
    street: Street
    buildings: Buildings
    note: (text: string) => void
  }) {
    this.#world = input.world
    this.#player = input.player
    this.#street = input.street
    this.#buildings = input.buildings
    this.#note = input.note
  }

  /** Ask somebody along, or tell them to stay where they are. */
  toggle(npcId: string, at: Vec2): void {
    const npc = this.#world.npc(npcId)
    if (!npc || !this.#street.walkable) return

    if (this.#player.isCompanion(npcId)) {
      this.#player.removeCompanion(npcId)
      this.#street.stopFollowing(npcId)
      this.#buildings.showPerson(npcId, true)
      this.#note(`${npc.name} stays here`)
      return
    }

    this.#player.addCompanion(npcId)
    this.#street.follow(npc, at)
    this.#buildings.showPerson(npcId, false)
    this.#note(`${npc.name} comes with you`)
  }

  /**
   * They waited outside while the player was in a building; put them back
   * beside the door the player came out of rather than where they were standing
   * when it closed.
   */
  regroup(at: Vec2): void {
    for (const npcId of this.#player.companions()) {
      const npc = this.#world.npc(npcId)
      if (!npc) continue
      this.#street.stopFollowing(npcId)
      this.#street.follow(npc, at)
    }
  }
}
