import { el, kbd } from '../dom.ts'
import type { HudWindowName } from '../types.ts'
import { WINDOW_TABS } from '../windows.ts'

/**
 * The four faces of the window, side by side, each with its key on it. It is
 * the window's title as well as its switch: whichever tab is lit is what the
 * player is reading. Left and right walk the strip, so the whole window can be
 * driven without leaving the keyboard.
 */
export class TabStrip {
  readonly node = el('div', 'gb-tabs')
  #buttons = new Map<HudWindowName, HTMLButtonElement>()

  constructor(pick: (name: HudWindowName) => void) {
    this.node.setAttribute('role', 'tablist')
    this.node.setAttribute('aria-label', 'Window')
    for (const tab of WINDOW_TABS) {
      const button = el('button', 'gb-tab')
      button.type = 'button'
      button.setAttribute('role', 'tab')
      button.setAttribute('aria-selected', 'false')
      button.append(el('span', 'gb-label', tab.title), kbd(tab.key))
      button.addEventListener('click', () => pick(tab.name))
      this.#buttons.set(tab.name, button)
      this.node.append(button)
    }
    this.node.addEventListener('keydown', (event) => this.#walk(event as KeyboardEvent, pick))
  }

  select(name: HudWindowName): void {
    for (const [tab, button] of this.#buttons) button.setAttribute('aria-selected', String(tab === name))
  }

  /** Left and right move along the strip and bring that face up as they land. */
  #walk(event: KeyboardEvent, pick: (name: HudWindowName) => void): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    const names = [...this.#buttons.keys()]
    const at = names.findIndex((name) => this.#buttons.get(name) === event.target)
    if (at === -1) return
    const next = names[(at + step + names.length) % names.length]!
    event.preventDefault()
    event.stopPropagation()
    this.#buttons.get(next)?.focus()
    pick(next)
  }
}
