import type { Interior } from '@gb/world'
import type { Situation } from './moves.ts'

/** How well a person has to think of the player before their door is open to them. */
const WELCOMING = new Set(['warm', 'friendly'])

/**
 * This person's home: the interior the file says is theirs, whether the
 * player can already get in, and whether they think enough of the player to
 * invite them. Their disposition decides that, and nothing else does.
 */
export class Home {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  interior(): Interior | undefined {
    const { world, npcId } = this.#situation
    return world.interiors().find((interior) => interior.owner === npcId)
  }

  /** The building, named the way the town names it. */
  name(): string | undefined {
    const interior = this.interior()
    return interior && this.#situation.world.plot(interior.plotId)?.name
  }

  /** True once the player can walk in: invited, or holding a card for it. */
  open(): boolean {
    const interior = this.interior()
    return interior !== undefined && this.#situation.player.opens({ interiorId: interior.id })
  }

  /** True while they like the player enough to have them round. */
  welcomes(): boolean {
    const { player, npcId } = this.#situation
    return WELCOMING.has(player.disposition(npcId))
  }

  /** True while an invitation is theirs to give: a home of their own the player cannot get into yet. */
  canInvite(): boolean {
    return this.interior() !== undefined && !this.open() && this.welcomes()
  }
}
