import { HUD_KEYS, TALK_HINTS, hintList } from '../controls.ts'
import { el, keyButton, setText } from '../dom.ts'
import { FocusReturn } from '../focus.ts'
import { Reveal } from '../reveal.ts'
import type { HudIntent, HudState } from '../types.ts'
import type { Surface } from './surface.ts'

const PLACEHOLDER = 'Say something'

/**
 * The conversation: who is speaking, their reply as it arrives, what they just
 * did, and the box the player answers in. It is the one part of the interface
 * that holds the keyboard, so it says how to leave in two places (the close
 * button and the line under the box) and lets go the instant it does.
 */
export class TalkSurface implements Surface {
  readonly node = el('section', 'gb-talk')
  #speaker = el('h3')
  #reply = el('p', 'gb-reply')
  #acted = el('p', 'gb-acted')
  #input = el('input', 'gb-say')
  #emit: (intent: HudIntent) => void
  #focus = new FocusReturn()
  #reveal: Reveal

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.node.setAttribute('role', 'group')
    this.node.setAttribute('aria-label', 'Conversation')
    this.#reply.setAttribute('aria-live', 'polite')
    this.#input.type = 'text'
    this.#input.placeholder = PLACEHOLDER
    this.#input.setAttribute('aria-label', PLACEHOLDER)

    const close = keyButton('gb-close', 'Close', HUD_KEYS.close, 'Close conversation (Escape)')
    close.addEventListener('click', () => this.#emit({ kind: 'talk-closed' }))
    const head = el('header', 'gb-talk-head')
    head.append(this.#speaker, close)

    this.node.append(head, this.#reply, this.#acted, this.#input, hintList(TALK_HINTS))
    this.#input.addEventListener('focus', () => this.#emit({ kind: 'typing', typing: true }))
    this.#input.addEventListener('blur', () => this.#emit({ kind: 'typing', typing: false }))

    this.#reveal = new Reveal(this.node, { onClosed: () => this.#clear() })
  }

  render(state: HudState): void {
    const talk = state.talk
    if (talk) {
      setText(this.#speaker, talk.speaker)
      setText(this.#reply, talk.reply)
      setText(this.#acted, talk.acted.join(' · '))
    }
    if (talk && !this.#reveal.open) this.#start()
    if (!talk && this.#reveal.open) this.#end()
  }

  /** Send what is in the box. False when there is nothing to send. */
  submit(): boolean {
    const text = this.#input.value.trim()
    if (!text) return false
    this.#input.value = ''
    this.#emit({ kind: 'say', text })
    return true
  }

  dispose(): void {
    this.#reveal.dispose()
  }

  #start(): void {
    this.#focus.remember(this.node)
    this.#input.value = ''
    this.#reveal.set(true)
    this.#input.focus()
  }

  #end(): void {
    this.#reveal.set(false)
    this.#input.blur()
    this.#focus.restore(this.node)
  }

  #clear(): void {
    this.#input.value = ''
    setText(this.#speaker, '')
    setText(this.#reply, '')
    setText(this.#acted, '')
  }
}
