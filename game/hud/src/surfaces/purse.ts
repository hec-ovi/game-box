import { questFirst } from '../carried.ts'
import { HUD_KEYS } from '../controls.ts'
import { el, flash, setText } from '../dom.ts'
import type { Carried, HudState } from '../types.ts'
import { MoreLine } from './more.ts'
import type { Surface } from './surface.ts'

/** How many things fit in the corner before the items tab is the better place. */
const AT_A_GLANCE = 4

/** Money and the few things worth seeing without opening anything. */
export class PurseSurface implements Surface {
  readonly node = el('aside', 'gb-purse')
  #money = el('strong', 'gb-coin')
  #num = el('span', 'gb-num')
  #list = el('ul')
  #more = new MoreLine(HUD_KEYS.items)
  #was: number | null = null
  #key: string | null = null

  constructor() {
    this.node.setAttribute('aria-label', 'Purse')
    this.#money.append(this.#num, el('span', 'gb-unit', 'coin'))
    this.node.append(this.#money, this.#list, this.#more.node)
  }

  render(state: HudState): void {
    if (state.money !== this.#was) {
      setText(this.#num, String(state.money))
      // Coin arriving and coin leaving are not the same event to a player.
      if (this.#was !== null) flash(this.#money, state.money > this.#was ? 'up' : 'down')
      this.#was = state.money
    }
    const key = state.carrying.map((item) => `${item.id}/${item.quest ? 'q' : ''}`).join('|')
    if (key === this.#key) return
    this.#key = key
    const rest = state.carrying.length - AT_A_GLANCE
    this.#list.replaceChildren(...questFirst(state.carrying).slice(0, AT_A_GLANCE).map(carried))
    this.#more.set(rest > 0 ? `${rest} more in hand` : null)
  }
}

function carried(item: Carried): HTMLLIElement {
  return el('li', item.quest ? 'gb-quest-item' : undefined, item.name)
}
