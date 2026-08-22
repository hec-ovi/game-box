import { HUD_KEYS } from '../controls.ts'
import { el, keyButton } from '../dom.ts'
import type { HudIntent, HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/**
 * The way in to the windows: one button each, with the key that does the same
 * thing printed on it. The keys go quiet while the player is writing, and the
 * buttons say so, because pressing J in a sentence types a J.
 */
export class BarSurface implements Surface {
  readonly node = el('nav', 'gb-bar')
  #journal = keyButton('gb-bar-button', 'Journal', HUD_KEYS.journal, 'Journal (J)')
  #help = keyButton('gb-bar-button', 'Controls', HUD_KEYS.help, 'Controls (?)')
  #typing: () => boolean

  constructor(emit: (intent: HudIntent) => void, typing: () => boolean) {
    this.#typing = typing
    this.node.setAttribute('aria-label', 'Interface')
    this.node.append(this.#journal, this.#help)
    this.#journal.addEventListener('click', () => emit({ kind: 'journal', open: !expanded(this.#journal) }))
    this.#help.addEventListener('click', () => emit({ kind: 'help', open: !expanded(this.#help) }))
  }

  render(state: HudState): void {
    this.#journal.setAttribute('aria-expanded', String(state.journalOpen))
    this.#help.setAttribute('aria-expanded', String(state.helpOpen))
    this.node.dataset.keysOff = String(this.#typing())
  }
}

function expanded(button: HTMLButtonElement): boolean {
  return button.getAttribute('aria-expanded') === 'true'
}
