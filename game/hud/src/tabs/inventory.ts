import { questFirst } from '../carried.ts'
import { el } from '../dom.ts'
import { NO_ITEMS } from '../phrase.ts'
import type { Carried, HudState, HudWindowName } from '../types.ts'
import type { Tab } from './tab.ts'

/** Everything the player carries: the coin they can spend, then what is in hand. */
export class InventoryTab implements Tab {
  readonly name: HudWindowName = 'inventory'
  readonly node = el('div', 'gb-inventory')
  #coin = el('span', 'gb-num')
  #list = el('ul', 'gb-carried')
  #key: string | null = null

  constructor() {
    const purse = el('p', 'gb-coin')
    purse.setAttribute('aria-label', 'Coin')
    purse.append(this.#coin, el('span', 'gb-unit', 'coin'))
    this.node.append(purse, this.#list)
  }

  render(state: HudState): void {
    const key = `${state.money}#${state.carrying.map((item) => `${item.id}${item.quest ? '!' : ''}`).join('|')}`
    if (key === this.#key) return
    this.#key = key
    this.#coin.textContent = String(state.money)
    const order = questFirst(state.carrying)
    this.#list.replaceChildren(...(order.length ? order.map(row) : [el('li', 'gb-empty', NO_ITEMS)]))
  }

  clear(): void {
    this.#key = null
    this.#coin.textContent = ''
    this.#list.replaceChildren()
  }
}

function row(item: Carried): HTMLLIElement {
  const node = el('li', item.quest ? 'gb-quest-item' : undefined)
  node.append(el('span', 'gb-mark', item.quest ? '◆' : '·'), el('span', 'gb-what', item.name))
  if (item.quest) node.append(el('span', 'gb-tag', 'Quest'))
  return node
}
