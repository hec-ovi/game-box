import { el, setText } from '../dom.ts'
import { Reveal } from '../reveal.ts'
import type { HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/** "E  Go into The Copper Wheel", while something is in reach. */
export class PromptSurface implements Surface {
  readonly node = el('section', 'gb-prompt')
  #key = el('kbd')
  #what = el('span')
  #reveal: Reveal

  constructor() {
    this.node.append(this.#key, this.#what)
    this.#reveal = new Reveal(this.node, { ms: 120, onClosed: () => this.#clear() })
  }

  render(state: HudState): void {
    const prompt = state.prompt
    if (prompt) {
      setText(this.#key, prompt.key)
      setText(this.#what, prompt.text)
    }
    this.#reveal.set(Boolean(prompt))
  }

  dispose(): void {
    this.#reveal.dispose()
  }

  #clear(): void {
    setText(this.#key, '')
    setText(this.#what, '')
  }
}
