import { el } from '../dom.ts'
import { Reveal } from '../reveal.ts'
import type { HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/**
 * The scene dimmed behind an open window: it says a window is up, keeps the
 * text readable over a bright street, and closes what it is behind when the
 * player clicks past it.
 */
export class ScrimSurface implements Surface {
  readonly node = el('div', 'gb-scrim')
  #reveal: Reveal

  constructor(dismiss: () => void) {
    this.#reveal = new Reveal(this.node)
    this.node.addEventListener('click', dismiss)
  }

  render(state: HudState): void {
    this.#reveal.set(state.journalOpen || state.helpOpen)
  }

  dispose(): void {
    this.#reveal.dispose()
  }
}
