import { HUD_HINTS, hintGroups } from '../controls.ts'
import { el } from '../dom.ts'
import type { HudState, HudWindowName } from '../types.ts'
import type { Tab } from './tab.ts'

/**
 * Every control in one place: what the game says its keys do, then the keys the
 * interface owns, so nobody has to leave the street to find out how to walk
 * down it.
 */
export class ControlsTab implements Tab {
  readonly name: HudWindowName = 'controls'
  readonly node = el('div', 'gb-controls')
  #key: string | null = null

  render(state: HudState): void {
    const hints = [...state.controls, ...HUD_HINTS]
    const key = hints.map((hint) => `${hint.group ?? ''}:${hint.keys.join('+')}:${hint.text}`).join('|')
    if (key === this.#key) return
    this.#key = key
    this.node.replaceChildren(...hintGroups(hints))
  }

  clear(): void {
    this.#key = null
    this.node.replaceChildren()
  }
}
