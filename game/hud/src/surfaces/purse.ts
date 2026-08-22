import { el, setText } from '../dom.ts'
import type { Carried, HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/** Money and what is being carried. */
export class PurseSurface implements Surface {
  readonly node = el('aside', 'gb-purse')
  #money = el('strong')
  #list = el('ul')
  #key: string | null = null

  constructor() {
    this.node.setAttribute('aria-label', 'Purse')
    this.node.append(this.#money, this.#list)
  }

  render(state: HudState): void {
    setText(this.#money, `${state.money} coin`)
    const key = state.carrying.map((item) => `${item.id}/${item.quest ? 'q' : ''}`).join('|')
    if (key === this.#key) return
    this.#key = key
    this.#list.replaceChildren(...state.carrying.map(carried))
  }
}

function carried(item: Carried): HTMLLIElement {
  return el('li', item.quest ? 'gb-quest-item' : undefined, item.name)
}
