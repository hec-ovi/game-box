import { el, kbd } from '../dom.ts'
import type { HudWindowName } from '../types.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { WINDOW_TABS } from '../windows.ts'

/**
 * The six faces of the window, side by side, each with its icon and its key.
 * Whichever tab is lit is what the player is reading. Left and right walk the
 * strip, so the whole window can be driven without leaving the keyboard.
 *
 * One accent underline slides between tabs rather than one lighting up per
 * tab, so the eye follows where it went.
 */
export class TabStrip {
  readonly node = el('div', 'gb-tabs')
  #line = el('span', 'gb-tab-line')
  #buttons = new Map<HudWindowName, HTMLButtonElement>()

  constructor(pick: (name: HudWindowName) => void) {
    this.node.setAttribute('role', 'tablist')
    this.node.setAttribute('aria-label', 'Window')
    for (const tab of WINDOW_TABS) {
      const button = el('button', 'gb-tab gb-cut')
      button.type = 'button'
      button.setAttribute('role', 'tab')
      button.setAttribute('aria-selected', 'false')
      button.append(icon(tab.icon, ICON_PX.tab), el('span', 'gb-t1', tab.title), kbd(tab.key))
      button.addEventListener('click', () => pick(tab.name))
      this.#buttons.set(tab.name, button)
      this.node.append(button)
    }
    this.node.append(this.#line)
    this.node.addEventListener('keydown', (event) => this.#walk(event as KeyboardEvent, pick))
  }

  select(name: HudWindowName): void {
    for (const [tab, button] of this.#buttons) button.setAttribute('aria-selected', String(tab === name))
    const on = this.#buttons.get(name)
    if (on) this.#line.style.transform = `translateX(${on.offsetLeft}px) scaleX(${on.offsetWidth})`
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
