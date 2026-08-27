import { HUD_KEYS, TALK_HINTS, TALK_PICK_HINT, hintList } from '../controls.ts'
import { el, setText } from '../dom.ts'
import { FocusReturn, cycleFocus } from '../focus.ts'
import { Reveal } from '../reveal.ts'
import type { HudIntent, HudState, TalkMove } from '../types.ts'
import { closeButton } from '../ui/act.ts'
import type { Surface } from './surface.ts'
import { Transcript } from './transcript.ts'

const PLACEHOLDER = 'Enter custom query_'

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
  readonly node = el('section', 'gb-talk gb-plate gb-cut gb-edged')
  /**
   * The moves, which stand at the foot of the screen and not in the panel.
   *
   * They cannot live inside it: the panel slides in on a transform, and a
   * transformed element is the containing block for anything fixed inside it,
   * so a list pinned to the bottom left of the screen ended up pinned to the
   * bottom left of the conversation. The hud mounts this beside the panel.
   */
  readonly aside = el('ul', 'gb-moves gb-scrolls')
  #speaker = el('h3', 'gb-head-name gb-t6')
  #transcript = new Transcript()
  #input = el('input', 'gb-say gb-field gb-cut gb-edged')
  #send = el('button', 'gb-talk-send-btn')
  #close: HTMLButtonElement
  #emit: (intent: HudIntent) => void
  #focus = new FocusReturn()
  #reveal: Reveal
  #drawn: string | undefined

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.node.setAttribute('role', 'group')
    this.node.setAttribute('aria-label', 'Conversation')
    this.aside.setAttribute('aria-label', 'What you can do')
    this.#input.type = 'text'
    this.#input.placeholder = PLACEHOLDER
    this.#input.setAttribute('aria-label', PLACEHOLDER)

    this.#send.type = 'button'
    this.#send.setAttribute('aria-label', 'Send message')
    this.#send.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`
    this.#send.addEventListener('click', () => {
      const text = this.#input.value.trim()
      if (text) {
        this.#input.value = ''
        this.#emit({ kind: 'say', text })
      }
    })

    this.#close = closeButton(HUD_KEYS.close, 'Close conversation (Escape)')
    this.#close.addEventListener('click', () => this.#emit({ kind: 'talk-closed' }))
    const head = el('header', 'gb-head')
    head.append(this.#speaker, this.#close)
    const inputRow = el('div', 'gb-talk-input-row')
    inputRow.append(this.#input, this.#send)
    const foot = el('div', 'gb-talk-foot')
    foot.append(inputRow)

    this.node.append(head, this.#transcript.node, foot)
    // The whole conversation holds the keyboard, not just the box: the player
    // can be on a move button, and the game must still not hear a walk key.
    // The moves stand outside the panel, so both are asked.
    for (const part of [this.node, this.aside]) {
      part.addEventListener('focusin', () => this.#emit({ kind: 'typing', typing: true }))
      part.addEventListener('focusout', (event) => {
        const to = (event as FocusEvent).relatedTarget
        if (!this.#holds(to)) this.#emit({ kind: 'typing', typing: false })
      })
    }

    this.#reveal = new Reveal(this.node, { kind: 'side', onClosed: () => this.#clear() })
  }

  render(state: HudState): void {
    const talk = state.talk
    if (talk) {
      setText(this.#speaker, talk.speaker)
      this.#transcript.render(talk.turns)
      this.#menu(talk.moves, talk.pending)
      this.#input.disabled = talk.pending
      this.#input.placeholder = talk.pending ? 'AI thinking...' : PLACEHOLDER
      if (talk.pending) {
        this.#send.disabled = true
        this.#send.innerHTML = `<span class="gb-ai-thinking-orb" data-thinking="true"></span>`
      } else {
        this.#send.disabled = false
        this.#send.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`
      }
    }
    if (talk && !this.#reveal.open) this.#start()
    if (!talk && this.#reveal.open) this.#end()
  }

  /** Whether the conversation still has the keyboard: the panel and the moves both count. */
  #holds(to: EventTarget | null): boolean {
    return to instanceof Node && (this.node.contains(to) || this.aside.contains(to))
  }

  /** Send what is in the box. False when the box has neither focus nor a line. */
  submit(): boolean {
    if (this.node.ownerDocument.activeElement !== this.#input && this.node.ownerDocument.activeElement !== this.#send) return false
    const text = this.#input.value.trim()
    if (!text) return false
    this.#input.value = ''
    this.#emit({ kind: 'say', text })
    return true
  }

  /** Tab round the conversation: the box, then the moves, then the way out. */
  cycle(back: boolean): boolean {
    return cycleFocus([this.#input, ...this.#buttons(), this.#close, this.#send], back)
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
      this.aside.replaceChildren(...moves.map((move, at) => this.#option(move, at)))
    }
    for (const button of this.#buttons()) {
      // A disabled button drops the keyboard on the floor, which would hand the
      // walk keys back to the game mid-conversation. The box takes it instead,
      // which is where the player is looking next anyway.
      if (pending && button === this.node.ownerDocument.activeElement) this.#input.focus()
      button.disabled = pending
    }
  }

  /** One move: the accent tab at its left edge, the words, and its number at the right. */
  #option(move: TalkMove, at: number): HTMLLIElement {
    const row = el('li')
    const button = el('button', 'gb-move gb-cut gb-edged')
    button.type = 'button'
    button.dataset.move = move.key
    const number = el('span', 'gb-num gb-t2', String(at + 1))
    number.setAttribute('aria-hidden', 'true')
    button.append(el('span', 'gb-what gb-t3', move.label), number)
    button.addEventListener('click', () => this.#emit({ kind: 'choose', key: move.key }))
    row.append(button)
    return row
  }

  #buttons(): HTMLButtonElement[] {
    return [...this.aside.querySelectorAll<HTMLButtonElement>('button.gb-move')]
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
    this.aside.replaceChildren()
  }
}
