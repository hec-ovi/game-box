import { HUD_KEYS, TALK_HINTS, TALK_PICK_HINT, hintList } from '../controls.ts'
import { el, keyButton, setText } from '../dom.ts'
import { FocusReturn, cycleFocus } from '../focus.ts'
import { Reveal } from '../reveal.ts'
import type { HudIntent, HudState, TalkMove } from '../types.ts'
import type { Surface } from './surface.ts'
import { Transcript } from './transcript.ts'

const PLACEHOLDER = 'Say something'

/**
 * The conversation, as a panel of fixed width down one side of the view: who
 * is speaking, everything said so far, the moves the player can take without
 * saying a word, and the box they answer in. It comes up when a conversation
 * starts and goes when it ends, and never changes size for what is in it: the
 * transcript scrolls inside it.
 *
 * Clicking a move and typing a line are the same thing said two ways, so both
 * put the player's own line on the transcript and both quiet the menu until
 * the game publishes the next one. It is the one part of the interface that
 * holds the keyboard, so it says how to leave in two places (the close button
 * and the line under the box) and lets go the instant focus leaves it.
 */
export class TalkSurface implements Surface {
  readonly node = el('section', 'gb-talk gb-bracket')
  #speaker = el('h3')
  #transcript = new Transcript()
  #moves = el('ul', 'gb-moves')
  #input = el('input', 'gb-say')
  #close: HTMLButtonElement
  #hints = el('div', 'gb-talk-hints')
  #emit: (intent: HudIntent) => void
  #focus = new FocusReturn()
  #reveal: Reveal
  #drawn: string | undefined

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.node.setAttribute('role', 'group')
    this.node.setAttribute('aria-label', 'Conversation')
    this.#moves.setAttribute('aria-label', 'What you can do')
    this.#input.type = 'text'
    this.#input.placeholder = PLACEHOLDER
    this.#input.setAttribute('aria-label', PLACEHOLDER)

    this.#close = keyButton('gb-close', 'Close', HUD_KEYS.close, 'Close conversation (Escape)')
    this.#close.addEventListener('click', () => this.#emit({ kind: 'talk-closed' }))
    const head = el('header', 'gb-talk-head')
    head.append(this.#speaker, this.#close)
    const foot = el('div', 'gb-talk-foot')
    foot.append(this.#moves, this.#input, this.#hints)

    this.node.append(head, this.#transcript.node, foot)
    // The whole panel holds the keyboard, not just the box: the player can be
    // on a move button, and the game must still not hear a walk key.
    this.node.addEventListener('focusin', () => this.#emit({ kind: 'typing', typing: true }))
    this.node.addEventListener('focusout', (event) => {
      const to = (event as FocusEvent).relatedTarget
      if (!(to instanceof Node) || !this.node.contains(to)) this.#emit({ kind: 'typing', typing: false })
    })

    this.#reveal = new Reveal(this.node, { onClosed: () => this.#clear() })
  }

  render(state: HudState): void {
    const talk = state.talk
    if (talk) {
      setText(this.#speaker, talk.speaker)
      this.#transcript.render(talk.turns)
      this.#menu(talk.moves, talk.pending)
    }
    if (talk && !this.#reveal.open) this.#start()
    if (!talk && this.#reveal.open) this.#end()
  }

  /** Send what is in the box. False when the box has neither focus nor a line. */
  submit(): boolean {
    if (this.node.ownerDocument.activeElement !== this.#input) return false
    const text = this.#input.value.trim()
    if (!text) return false
    this.#input.value = ''
    this.#emit({ kind: 'say', text })
    return true
  }

  /** Tab round the conversation: the box, then the moves, then the way out. */
  cycle(back: boolean): boolean {
    return cycleFocus([this.#input, ...this.#buttons(), this.#close], back)
  }

  dispose(): void {
    this.#reveal.dispose()
  }

  /**
   * The moves worth clicking, drawn only while there are some. Rebuilt when the
   * list itself changes and never for a reply arriving, so a menu the player is
   * reading does not flicker word by word.
   */
  #menu(moves: readonly TalkMove[], pending: boolean): void {
    const key = JSON.stringify(moves)
    if (key !== this.#drawn) {
      this.#drawn = key
      this.#moves.replaceChildren(...moves.map((move) => this.#option(move)))
      this.#hints.replaceChildren(hintList(moves.length ? [TALK_PICK_HINT, ...TALK_HINTS] : TALK_HINTS))
    }
    for (const button of this.#buttons()) {
      // A disabled button drops the keyboard on the floor, which would hand the
      // walk keys back to the game mid-conversation. The box takes it instead,
      // which is where the player is looking next anyway.
      if (pending && button === this.node.ownerDocument.activeElement) this.#input.focus()
      button.disabled = pending
    }
  }

  #option(move: TalkMove): HTMLLIElement {
    const row = el('li')
    const button = el('button', 'gb-move')
    button.type = 'button'
    button.dataset.move = move.key
    button.textContent = move.label
    button.addEventListener('click', () => this.#emit({ kind: 'choose', key: move.key }))
    row.append(button)
    return row
  }

  #buttons(): HTMLButtonElement[] {
    return [...this.#moves.querySelectorAll<HTMLButtonElement>('button.gb-move')]
  }

  #start(): void {
    this.#focus.remember(this.node)
    this.#input.value = ''
    this.#reveal.set(true)
    this.#input.focus()
  }

  #end(): void {
    // Handing focus back takes it off the panel, which is what reports typing off.
    this.#reveal.set(false)
    this.#focus.restore(this.node)
  }

  #clear(): void {
    this.#input.value = ''
    this.#drawn = undefined
    setText(this.#speaker, '')
    this.#transcript.clear()
    this.#moves.replaceChildren()
    this.#hints.replaceChildren()
  }
}
