import { carriedList } from '../carried.ts'
import { el } from '../dom.ts'
import { CREDITS, NO_ITEMS } from '../phrase.ts'
import type { HudState, HudWindowName } from '../types.ts'
import { homesSection } from './home.ts'
import type { Tab } from './tab.ts'

/** Everything the player owns: the credits they can spend, what is in hand, and the places that are theirs. */
export class InventoryTab implements Tab {
  readonly name: HudWindowName = 'inventory'
  readonly node = el('div', 'gb-inventory')
  #coin = el('span', 'gb-num')
  #body = el('div')
  #key: string | null = null

  constructor() {
    const purse = el('p', 'gb-coin')
    purse.setAttribute('aria-label', 'Credits')
    purse.append(this.#coin, el('span', 'gb-unit', CREDITS))
    this.node.append(purse, this.#body)
  }

  render(state: HudState): void {
    const key = JSON.stringify([state.money, state.carrying, state.homes])
    if (key === this.#key) return
    this.#key = key
    this.#coin.textContent = String(state.money)
    this.#body.replaceChildren(carriedList(state.carrying, 'gb-carried', NO_ITEMS), homesSection(state.homes))
  }

  clear(): void {
    this.#key = null
    this.#coin.textContent = ''
    this.#body.replaceChildren()
  }
}
