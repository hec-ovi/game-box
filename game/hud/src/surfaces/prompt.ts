import { el, setText } from '../dom.ts'
import type { HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/** "E  Go into The Copper Wheel", while something is in reach. */
export class PromptSurface implements Surface {
  readonly node = el('section', 'gb-prompt')
  #key = el('kbd')
  #what = el('span')

  constructor() {
    this.node.hidden = true
    this.node.append(this.#key, this.#what)
  }

  render(state: HudState): void {
    const prompt = state.prompt
    this.node.hidden = !prompt
    setText(this.#key, prompt?.key ?? '')
    setText(this.#what, prompt?.text ?? '')
  }
}
