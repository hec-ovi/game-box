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
  #showcase = el('div', 'gb-inv-showcase gb-plate gb-cut gb-edged')
  #mesh = el('div', 'gb-inv-3d-mesh')
  #showcaseName = el('h3', 'gb-t6 gb-inv-name', 'Item Showcase')
  #showcaseValue = el('p', 'gb-t2 gb-inv-value', 'Select an item to inspect')
  #showcaseDesc = el('p', 'gb-t3 gb-inv-desc', 'Physical artifact or tool stored in inventory.')
  #showcaseQuest = el('div', 'gb-inv-quest-badge gb-t1', '')
  #body = el('div', 'gb-inv-grid-pane gb-scrolls')
  #key: string | null = null
  #rotX = 20
  #rotY = 0
  #dragging = false
  #lastPointerX = 0
  #lastPointerY = 0

  constructor() {
    const box3d = el('div', 'gb-inv-3d-box')
    box3d.append(this.#mesh)
    box3d.addEventListener('pointerdown', (e) => {
      this.#dragging = true
      this.#lastPointerX = e.clientX
      this.#lastPointerY = e.clientY
      box3d.setPointerCapture(e.pointerId)
    })
    box3d.addEventListener('pointermove', (e) => {
      if (!this.#dragging) return
      const dx = e.clientX - this.#lastPointerX
      const dy = e.clientY - this.#lastPointerY
      this.#rotY += dx * 0.8
      this.#rotX -= dy * 0.8
      this.#lastPointerX = e.clientX
      this.#lastPointerY = e.clientY
      this.#mesh.style.transform = `rotateY(${this.#rotY}deg) rotateX(${this.#rotX}deg)`
    })
    box3d.addEventListener('pointerup', () => {
      this.#dragging = false
    })

    this.#showcase.append(this.#showcaseName, box3d, this.#showcaseValue, this.#showcaseDesc, this.#showcaseQuest)

    const purse = el('p', 'gb-coin gb-cut gb-edged')
    purse.setAttribute('aria-label', 'Credits')
    this.#coin.node.classList.add('gb-t7')
    purse.append(icon('credit', ICON_PX.tile), this.#coin.node, el('span', 'gb-unit', CREDITS))

    const rightPane = el('div', 'gb-inv-right-pane')
    rightPane.append(purse, this.#body)

    this.node.append(this.#showcase, rightPane)
  }

  render(state: HudState): void {
    const key = JSON.stringify([state.money, state.carrying, state.homes])
    if (key === this.#key) return
    this.#key = key
    this.#coin.set(state.money)

    const items = state.carrying ?? []
    if (items.length > 0) {
      this.#selectItem(items[0]!)
    } else {
      this.#showcaseName.textContent = 'Empty Inventory'
      this.#showcaseValue.textContent = '0 items in pockets'
      this.#showcaseDesc.textContent = 'Explore the city districts to collect items, tools, and quest relics.'
      this.#showcaseQuest.hidden = true
    }

    const grid = el('div', 'gb-inv-slots-grid')
    const totalSlots = 16
    for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
      const item = items[slotIndex]
      const slot = el('div', 'gb-inv-slot gb-cut')
      if (item) {
        slot.dataset.filled = 'true'
        slot.append(icon('item', ICON_PX.tile), el('span', 'gb-slot-label gb-t0 gb-clip', item.name))
        if (item.quest) {
          const star = el('span', 'gb-slot-quest-star', '★')
          slot.append(star)
        }
        slot.addEventListener('click', () => this.#selectItem(item))
      } else {
        slot.classList.add('gb-slot-empty')
        const num = String(slotIndex + 1).padStart(2, '0')
        slot.append(el('span', 'gb-slot-empty-num gb-t0', `[${num}]`))
      }
      grid.append(slot)
    }

    const carried = carriedList(state.carrying, 'gb-carried', NO_ITEMS)
    carried.addEventListener('click', (e) => {
      const row = (e.target as HTMLElement).closest('.gb-row')
      if (!row) return
      const title = row.querySelector('.gb-row-title')?.textContent
      const matched = items.find((i) => i.name === title)
      if (matched) this.#selectItem(matched)
    })

    this.#body.replaceChildren(grid, carried, homesSection(state.homes))
  }

  #selectItem(item: { name: string; quest?: boolean; value?: number; text?: string }): void {
    this.#showcaseName.textContent = item.name
    this.#showcaseValue.textContent = item.quest ? 'Quest Essential Item' : `Value: ${item.value ?? 0} credits`
    this.#showcaseDesc.textContent = item.text ?? (item.quest ? 'Required for active district quest line.' : 'General utility item in your inventory.')
    if (item.quest) {
      this.#showcaseQuest.textContent = '★ Assigned to Active Quest Line'
      this.#showcaseQuest.hidden = false
    } else {
      this.#showcaseQuest.textContent = ''
      this.#showcaseQuest.hidden = true
    }
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
