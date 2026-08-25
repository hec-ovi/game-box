import type { Situation } from './moves.ts'

/** One thing this person sells, and its price in credits. */
export interface Ware {
  readonly itemId: string
  readonly name: string
  readonly price: number
}

/**
 * What this person sells: the things the file gives them as owner, with a
 * price on them, lying on the surfaces of the building they keep a spot in,
 * that the player has not bought or moved. The counter is where money
 * changes hands; this is the list the person names across it.
 */
export class Stock {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  wares(): readonly Ware[] {
    const { world, player, npcId } = this.#situation
    const interiorId = world.npc(npcId)?.station?.interiorId
    if (!interiorId) return []
    const wares: Ware[] = []
    for (const placement of world.placements()) {
      if (placement.at !== 'anchor' || placement.interiorId !== interiorId) continue
      const item = world.item(placement.itemId)
      if (!item || item.ownerNpcId !== npcId || !item.value) continue
      if (player.has(item.id) || player.placedAt(item.id)) continue
      wares.push({ itemId: item.id, name: item.name.toLowerCase(), price: item.value })
    }
    return wares
  }

  /** The ware a thing is, when this person sells it. */
  ware(itemId: string): Ware | undefined {
    return this.wares().find((ware) => ware.itemId === itemId)
  }
}
