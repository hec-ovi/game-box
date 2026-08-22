import { el, setText } from '../dom.ts'
import type { HudIntent, HudState } from '../types.ts'
import type { Surface } from './surface.ts'

const PLACEHOLDER = 'Say something, or press Escape to walk away'

/**
 * The conversation: who is speaking, their reply as it arrives, what they just
 * did, and the box the player answers in. It is the one part of the interface
 * that takes the pointer and the keyboard, so it also reports when the player
 * is typing and the game has to let go of its keys.
 */
export class TalkSurface implements Surface {
  readonly node = el('section', 'gb-talk')
  #speaker = el('h3')
  #reply = el('p', 'gb-reply')
  #acted = el('p', 'gb-acted')
  #input = el('input', 'gb-say')
  #open = false

  constructor(emit: (intent: HudIntent) => void) {
    this.node.hidden = true
    this.node.setAttribute('aria-label', 'Conversation')
    this.#reply.setAttribute('aria-live', 'polite')
    this.#input.type = 'text'
    this.#input.placeholder = PLACEHOLDER
    this.#input.setAttribute('aria-label', 'Say something')
    this.node.append(this.#speaker, this.#reply, this.#acted, this.#input)

    this.#input.addEventListener('focus', () => emit({ kind: 'typing', typing: true }))
    this.#input.addEventListener('blur', () => emit({ kind: 'typing', typing: false }))
    this.#input.addEventListener('keydown', (event) => {
      // The game listens on the window; while the player is typing it hears nothing.
      event.stopPropagation()
      if (event.key === 'Escape') {
        emit({ kind: 'talk-closed' })
        return
      }
      if (event.key !== 'Enter') return
      const text = this.#input.value.trim()
      if (!text) return
      this.#input.value = ''
      emit({ kind: 'say', text })
    })
  }

  render(state: HudState): void {
    const talk = state.talk
    this.node.hidden = !talk
    setText(this.#speaker, talk?.speaker ?? '')
    setText(this.#reply, talk?.reply ?? '')
    setText(this.#acted, talk?.acted.join(' · ') ?? '')

    if (talk && !this.#open) this.#input.focus()
    if (!talk && this.#open) {
      this.#input.value = ''
      this.#input.blur()
    }
    this.#open = Boolean(talk)
  }
}
