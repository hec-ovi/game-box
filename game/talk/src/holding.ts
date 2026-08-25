import { Home } from './home.ts'
import type { Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { Stock } from './stock.ts'
import { fill, keyed } from './text.ts'

const LINES = keyed(PROMPTS.holding)

/**
 * The "what you hold" slots of the brief: what this person sells and the
 * price of each, what is on them, and their home with whether the one in
 * front of them is welcome in it. All read off the world and the playthrough
 * on the call, so a thing sold or a door opened is gone from the next turn.
 */
export class Holding {
  #situation: Situation
  #stock: Stock
  #home: Home

  constructor(situation: Situation) {
    this.#situation = situation
    this.#stock = new Stock(situation)
    this.#home = new Home(situation)
  }

  wares(): string {
    const list = this.#stock.wares().map((ware) => fill(LINES.ware!, { name: ware.name, price: String(ware.price) }))
    return list.length ? fill(LINES.wares!, { list: list.join('; ') }) : LINES['wares-none']!
  }

  pocket(): string {
    const { world, npcId } = this.#situation
    const items = world
      .placements()
      .filter((placement) => placement.at === 'npc' && placement.npcId === npcId)
      .map((placement) => world.item(placement.itemId)?.name.toLowerCase())
      .filter((name) => name !== undefined)
    return items.length ? fill(LINES.pocket!, { items: items.join(', ') }) : LINES['pocket-none']!
  }

  home(): string {
    const place = this.#home.name()
    if (!place) return LINES['home-none']!
    const key = this.#home.open() ? 'home-open' : this.#home.welcomes() ? 'home-welcome' : 'home-unwelcome'
    return fill(LINES[key]!, { place })
  }
}
