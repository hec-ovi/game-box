import { carriedList } from '../carried.ts'
import { el } from '../dom.ts'
import { CREDITS, NO_ITEMS } from '../phrase.ts'
import type { HudState, HudWindowName } from '../types.ts'
import { Count } from '../ui/count.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { homesSection } from './home.ts'
import type { Tab } from './tab.ts'

/**
 * Everything the player owns: the credits they can spend, what is in hand, and
 * the places that are theirs. Money is a thing the player carries, so it is
 * read here and in no corner, and it counts to what it becomes rather than
 * jumping there.
 */
export class InventoryTab implements Tab {
  readonly name: HudWindowName = 'inventory'
  readonly node = el('div', 'gb-inventory')
  #coin = new Count()
  #body = el('div')
  #key: string | null = null

  constructor() {
    const purse = el('p', 'gb-coin gb-cut gb-edged')
    purse.setAttribute('aria-label', 'Credits')
    this.#coin.node.classList.add('gb-t7')
    purse.append(icon('credit', ICON_PX.tile), this.#coin.node, el('span', 'gb-unit', CREDITS))
    this.node.append(purse, this.#body)
  }

  render(state: HudState): void {
    const key = JSON.stringify([state.money, state.carrying, state.homes])
    if (key === this.#key) return
    this.#key = key
    this.#coin.set(state.money)
    this.#body.replaceChildren(carriedList(state.carrying, 'gb-carried', NO_ITEMS), homesSection(state.homes))
  }

  clear(): void {
    this.#key = null
    this.#coin.reset()
    this.#body.replaceChildren()
  }

  dispose(): void {
    this.#coin.dispose()
  }
}
