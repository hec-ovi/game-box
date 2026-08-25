import type { CounterView, Hud } from '@gb/hud'
import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import { PLAYER, type Item, type World } from '@gb/world'
import type { Buildings } from './buildings.ts'
import type { Locks } from './locks.ts'
import type { Reporting } from './reporting.ts'

/**
 * Buying at a counter. Whoever keeps a counter owns the things standing on it,
 * and each carries the price the city priced it at, so what is for sale is
 * read off the city rather than kept anywhere. The counter opens when the
 * person behind it names their stock, which is `@gb/talk`'s `show_wares`;
 * `@gb/play` moves the money and the thing in one call; a deed moves the
 * house, which is a fact about the city and is written into it.
 */
export class Counters {
  #world: World
  #player: PlayerState
  #log: QuestLog
  #hud: Hud
  #report: Reporting
  #buildings: Buildings
  #locks: Locks
  #seller: string | undefined

  constructor(input: {
    world: World
    player: PlayerState
    log: QuestLog
    hud: Hud
    report: Reporting
    buildings: Buildings
    locks: Locks
  }) {
    this.#world = input.world
    this.#player = input.player
    this.#log = input.log
    this.#hud = input.hud
    this.#report = input.report
    this.#buildings = input.buildings
    this.#locks = input.locks
  }

  /** Open the counter of whoever the player is talking to. */
  open(npcId: string): void {
    const view = this.#view(npcId)
    if (!view) return
    this.#seller = npcId
    this.#hud.show({ counter: view })
  }

  /**
   * Pay for one of the things on the counter. The money and the thing move
   * together in `@gb/play`; a purchase is both bought and acquired, so a job
   * that says to buy it and a job that says to fetch it both see it.
   */
  buy(itemId: string): void {
    const item = this.#world.item(itemId)
    if (!item || this.#seller === undefined) return
    const paid = this.#player.buy(itemId, item.value ?? 0)
    if (!paid.ok) {
      this.#report.note(`Not enough credits for the ${item.name.toLowerCase()}`)
      return
    }
    // it is off the counter it was standing on, and in the player's hands
    this.#buildings.lift(itemId)
    this.#hud.announce({ kind: 'money', delta: -(item.value ?? 0) })
    this.#hud.announce({ kind: 'item-taken', item: item.name })
    this.#deed(item)
    this.#report.report(this.#log.handle({ kind: 'bought', itemId }))
    this.#report.report(this.#log.handle({ kind: 'acquired', itemId }))
    this.open(this.#seller)
  }

  /**
   * The counter goes: Escape, the close button, or the conversation it was
   * opened from ending. Taking it off the screen is said out loud, because
   * walking away from somebody is not a click the interface heard.
   */
  closed(): void {
    if (this.#seller === undefined) return
    this.#seller = undefined
    this.#hud.show({ counter: null })
  }

  /**
   * A deed is the house it names. Whose a place is lives in the city file, so
   * the purchase is written there as well as into the playthrough, and the
   * door of the place opens for its owner from that moment.
   */
  #deed(item: Item): void {
    if (item.deedTo === undefined) return
    this.#player.own(item.deedTo)
    this.#world.recordOwner(item.deedTo, PLAYER)
    this.#locks.granted({ interiorId: item.deedTo })
    const interior = this.#world.interior(item.deedTo)
    const plot = interior ? this.#world.plot(interior.plotId) : undefined
    this.#report.note(plot ? `${plot.name} is yours` : 'The place is yours')
  }

  #view(npcId: string): CounterView | undefined {
    const seller = this.#world.npc(npcId)
    if (!seller) return undefined
    return {
      seller: seller.name,
      offers: this.#offers(npcId).map((item) => ({ id: item.id, name: item.name, price: item.value ?? 0 })),
    }
  }

  /**
   * What that person has for sale: everything of theirs standing on a surface
   * in the building they keep, with a price on it. Something the player has
   * already bought, taken or moved is off the counter, because it is not
   * standing there any more.
   */
  #offers(npcId: string): readonly Item[] {
    const interiorId = this.#world.npc(npcId)?.station?.interiorId
    if (interiorId === undefined) return []
    const found: Item[] = []
    for (const placement of this.#world.placements()) {
      if (placement.at !== 'anchor' || placement.interiorId !== interiorId) continue
      const item = this.#world.item(placement.itemId)
      if (!item || item.ownerNpcId !== npcId || (item.value ?? 0) <= 0) continue
      if (this.#player.has(item.id) || this.#player.placedAt(item.id)) continue
      found.push(item)
    }
    return found
  }
}
