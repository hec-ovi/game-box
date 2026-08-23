import { el, keyButton } from '../dom.ts'
import type { HudIntent, HudState } from '../types.ts'
import { WINDOW_TABS } from '../windows.ts'
import type { Surface } from './surface.ts'

/**
 * The way in to the window: one button per face, with the key that does the
 * same thing printed on it. The keys go quiet while the player is writing, and
 * the buttons say so, because pressing J in a sentence types a J.
 */
export class BarSurface implements Surface {
  readonly node = el('nav', 'gb-bar')
  #buttons = WINDOW_TABS.map((tab) => ({
    tab,
    button: keyButton('gb-bar-button', tab.title, tab.key, `${tab.title} (${tab.key})`),
  }))
  #typing: () => boolean

  constructor(emit: (intent: HudIntent) => void, typing: () => boolean) {
    this.#typing = typing
    this.node.setAttribute('aria-label', 'Interface')
    for (const { tab, button } of this.#buttons) {
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') === 'true'
        emit({ kind: 'window', window: open ? null : tab.name })
      })
      this.node.append(button)
    }
  }

  render(state: HudState): void {
    for (const { tab, button } of this.#buttons) {
      button.setAttribute('aria-expanded', String(state.window === tab.name))
    }
    this.node.dataset.keysOff = String(this.#typing())
  }
}
