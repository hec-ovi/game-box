import { el } from '../dom.ts'
import { CREDITS, NO_ITEMS, priceText } from '../phrase.ts'
import type { Carried, HudIntent, HudState, HudWindowName, Inspecting } from '../types.ts'
import { Count } from '../ui/count.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { homesSection } from './home.ts'
import { Turntable } from './turntable.ts'
import type { Tab } from './tab.ts'

/**
 * Everything the player owns: the credits they can spend, what is in hand, and
 * the places that are theirs. Money is a thing the player carries, so it is
 * read here and in no corner, and it counts to what it becomes rather than
 * jumping there.
 *
 * The thing that is open is shown beside the grid, turnable: the game draws it
 * from the same model the city puts on a shelf and hands the views over, so
 * what the player picked up and what they are looking at are one object.
 */
export class InventoryTab implements Tab {
  readonly name: HudWindowName = 'inventory'
  readonly node = el('div', 'gb-inventory')
  #emit: (intent: HudIntent) => void
  #coin = new Count()
  #showcase = el('div', 'gb-inv-showcase gb-plate gb-cut gb-edged')
  #turntable = new Turntable()
  #name = el('h3', 'gb-t6 gb-inv-name')
  #line = el('p', 'gb-t2 gb-inv-value')
  #what = el('p', 'gb-t3 gb-inv-desc')
  #questTag = el('div', 'gb-inv-quest-badge gb-t1', '')
  #grid = el('div', 'gb-inv-slots-grid')
  #body = el('div', 'gb-inv-grid-pane gb-scrolls')
  #key: string | null = null
  #openId: string | undefined

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.#showcase.append(this.#name, this.#turntable.node, this.#line, this.#what, this.#questTag)

    const purse = el('p', 'gb-coin gb-cut gb-edged')
    purse.setAttribute('aria-label', 'Credits')
    this.#coin.node.classList.add('gb-t7')
    purse.append(icon('credit', ICON_PX.tile), this.#coin.node, el('span', 'gb-unit', CREDITS))

    const right = el('div', 'gb-inv-right-pane')
    right.append(purse, this.#body)
    this.node.append(this.#showcase, right)
  }

  render(state: HudState): void {
    this.#turntable.set(state.inspecting)
    const key = JSON.stringify([state.money, state.carrying, state.homes])
    if (key === this.#key) return
    this.#key = key
    this.#coin.set(state.money)

    // quest items first: what a job is waiting on is what the player came here
    // to check, and the order is stable within each half
    const items = [...(state.carrying ?? [])].sort((one, other) => Number(Boolean(other.quest)) - Number(Boolean(one.quest)))
    this.#grid.replaceChildren(...items.map((item) => this.#slot(item)))
    this.#body.replaceChildren(
      items.length ? this.#grid : el('p', 'gb-empty gb-t3', NO_ITEMS),
      homesSection(state.homes),
    )

    // whatever was open stays open while it is still in hand; otherwise the
    // first thing is, so the panel beside the grid is never blank with a full
    // grid next to it
    const open = items.find((item) => item.id === this.#openId) ?? items[0]
    if (open) this.#open(open)
    else this.#empty()
  }

  clear(): void {
    this.#key = null
    this.#openId = undefined
    this.#coin.reset()
    this.#turntable.clear()
    this.#body.replaceChildren()
  }

  dispose(): void {
    this.#coin.dispose()
    this.#turntable.dispose()
  }

  /** One thing in the grid: its picture, its name, and a mark when a job wants it. */
  #slot(item: Carried): HTMLElement {
    const slot = el('button', 'gb-inv-slot gb-cut')
    slot.type = 'button'
    slot.dataset.filled = 'true'
    if (item.id === this.#openId) slot.dataset.open = 'true'
    slot.append(icon('item', ICON_PX.tile), el('span', 'gb-slot-label gb-t0 gb-clip', item.name))
    if (item.quest) slot.append(el('span', 'gb-slot-quest gb-t0', 'Quest'))
    else if (item.value !== undefined) slot.append(el('span', 'gb-value gb-t0', priceText(item.value)))
    slot.addEventListener('click', () => this.#open(item))
    return slot
  }

  #open(item: Carried): void {
    const fresh = item.id !== this.#openId
    this.#openId = item.id
    this.#name.textContent = item.name
    this.#line.textContent = item.quest ? 'A job wants this' : item.value === undefined ? '' : `Worth ${priceText(item.value)}`
    this.#what.textContent = item.text ?? ''
    this.#what.hidden = !item.text
    this.#questTag.hidden = !item.quest
    this.#questTag.textContent = item.quest ? 'Held for a job' : ''
    for (const slot of this.#grid.querySelectorAll<HTMLElement>('.gb-inv-slot')) delete slot.dataset.open
    for (const slot of this.#grid.querySelectorAll<HTMLElement>('.gb-inv-slot')) {
      if (slot.querySelector('.gb-slot-label')?.textContent === item.name) slot.dataset.open = 'true'
    }
    // the game draws it and pushes the views back; asking twice for the same
    // thing would redraw what is already on screen
    if (fresh) this.#emit({ kind: 'inspect', itemId: item.id })
  }

  #empty(): void {
    this.#openId = undefined
    this.#name.textContent = 'Nothing in hand'
    this.#line.textContent = ''
    this.#what.textContent = 'What you pick up is kept here.'
    this.#what.hidden = false
    this.#questTag.hidden = true
    this.#turntable.clear()
  }
}
