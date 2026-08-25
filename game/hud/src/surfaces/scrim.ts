import { el } from '../dom.ts'
import { Reveal } from '../reveal.ts'
import type { HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/**
 * The scene dimmed behind whatever is open in front of it, the window, the
 * counter, a screen or a question: it says something is up, keeps the text
 * readable over a bright street, and closes what it is behind when the player
 * clicks past it. Clicking past a question is the same as answering no.
 */
export class ScrimSurface implements Surface {
  readonly node = el('div', 'gb-scrim')
  #reveal: Reveal

  constructor(dismiss: () => void) {
    this.#reveal = new Reveal(this.node)
    this.node.addEventListener('click', dismiss)
  }

  render(state: HudState): void {
    this.#reveal.set(
      state.window !== null || state.counter !== undefined || state.screen !== undefined || state.confirm !== undefined,
    )
  }

  dispose(): void {
    this.#reveal.dispose()
  }
}
