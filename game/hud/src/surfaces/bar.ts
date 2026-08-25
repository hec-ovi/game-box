import { LEAVE } from '../controls.ts'
import { el, kbd } from '../dom.ts'
import type { HudIntent, HudState } from '../types.ts'
import { ICON_PX, icon, type IconName } from '../ui/icon.ts'
import { WINDOW_TABS } from '../windows.ts'
import type { Surface } from './surface.ts'

/**
 * The strip along the foot: one button per face of the window and one to leave,
 * each with its icon and the key that does the same thing. The face that is
 * open wears the accent underline; the way out sits apart at the right.
 *
 * The keys go quiet while the player is writing, and the buttons say so,
 * because pressing J in a sentence types a J. The strip itself lets clicks
 * through to the street; only its buttons take them.
 */
export class BarSurface implements Surface {
  readonly node = el('nav', 'gb-bar')
  #buttons = WINDOW_TABS.map((tab) => ({ tab, button: barButton(tab.icon, tab.title, tab.key) }))
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
    const leave = barButton('leave', LEAVE.title, LEAVE.key)
    leave.classList.add('gb-bar-leave')
    leave.addEventListener('click', () => emit({ kind: 'exit' }))
    this.node.append(leave)
  }

  render(state: HudState): void {
    for (const { tab, button } of this.#buttons) {
      button.setAttribute('aria-expanded', String(state.window === tab.name))
    }
    this.node.dataset.keysOff = String(this.#typing())
  }
}

function barButton(name: IconName, title: string, key: string): HTMLButtonElement {
  const node = el('button', 'gb-bar-button gb-cut')
  node.type = 'button'
  node.setAttribute('aria-label', `${title} (${key})`)
  node.append(icon(name, ICON_PX.tab), el('span', 'gb-t1', title), kbd(key))
  return node
}
