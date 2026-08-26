import { el, kbd, setText } from '../dom.ts'
import { Reveal } from '../reveal.ts'
import type { HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/** "E  [Context Icon] Go into The Copper Wheel / Talk to Mara Quill", embedded seamlessly into the footer HUD. */
export class PromptSurface implements Surface {
  readonly node = el('section', 'gb-prompt')
  #key = kbd('')
  #icon = el('span', 'gb-prompt-anim-icon')
  #what = el('span', 'gb-prompt-text gb-t3')
  #reveal: Reveal

  constructor() {
    this.node.append(this.#key, this.#icon, this.#what)
    this.#reveal = new Reveal(this.node, { kind: 'prompt', onClosed: () => this.#clear() })
  }

  render(state: HudState): void {
    const prompt = state.prompt
    if (prompt) {
      setText(this.#key, prompt.key)
      setText(this.#what, prompt.text)
      const isTalk = /talk|speak|chat|ask|tell/i.test(prompt.text)
      this.#icon.innerHTML = isTalk ? mouthIcon() : doorIcon()
    }
    this.#reveal.set(Boolean(prompt))
  }

  dispose(): void {
    this.#reveal.dispose()
  }

  #clear(): void {
    setText(this.#key, '')
    setText(this.#what, '')
    this.#icon.replaceChildren()
  }
}

function mouthIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18 C4 14 7 12 12 12 C17 12 20 14 20 18"/><circle cx="12" cy="7" r="4"/><path d="M18 7c1.2 1.2 1.2 3.6 0 4.8M21 5c2.2 2.2 2.2 6.6 0 8.8"/></svg>`
}

function doorIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20"/><path d="M14 12h.01"/><path d="M4 22h16"/></svg>`
}
