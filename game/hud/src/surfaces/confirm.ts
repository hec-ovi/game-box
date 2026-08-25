import { HUD_KEYS } from '../controls.ts'
import { el, keyButton } from '../dom.ts'
import { FocusReturn, trapTab } from '../focus.ts'
import { CONFIRM } from '../phrase.ts'
import { Reveal } from '../reveal.ts'
import type { ConfirmAsk, HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/**
 * "You sure?", in place. One panel for anything that throws work away: it
 * names what is about to be lost, offers Yes and No, keeps the keyboard while
 * it is up (Enter is yes, Escape is no) and hands focus back to whatever had
 * it. It reports the answer and changes nothing itself, so what happens next
 * belongs to whoever asked.
 */
export class ConfirmSurface implements Surface {
  readonly node = el('div', 'gb-confirm-room')
  #frame = el('section', 'gb-confirm gb-bracket')
  #title = el('h2')
  #question = el('p', 'gb-confirm-question')
  #yes = keyButton('gb-confirm-yes', CONFIRM.yes, HUD_KEYS.send, `${CONFIRM.yes} (${HUD_KEYS.send})`)
  #no = keyButton('gb-confirm-no', CONFIRM.no, HUD_KEYS.close, `${CONFIRM.no} (${HUD_KEYS.close})`)
  #reveal: Reveal
  #focus = new FocusReturn()
  #answer: (ask: ConfirmAsk, yes: boolean) => void
  #ask: ConfirmAsk | undefined

  constructor(answer: (ask: ConfirmAsk, yes: boolean) => void) {
    this.#answer = answer
    this.#frame.setAttribute('role', 'alertdialog')
    this.#frame.setAttribute('aria-modal', 'true')
    this.#frame.tabIndex = -1
    this.#yes.addEventListener('click', () => this.answer(true))
    this.#no.addEventListener('click', () => this.answer(false))

    const acts = el('div', 'gb-confirm-acts')
    acts.append(this.#no, this.#yes)
    this.#frame.append(this.#title, this.#question, acts)
    this.node.append(this.#frame)
    this.#reveal = new Reveal(this.#frame)
  }

  render(state: HudState): void {
    const ask = state.confirm
    if (ask && ask !== this.#ask) {
      this.#title.textContent = CONFIRM.asks[ask].title
      this.#question.textContent = CONFIRM.asks[ask].question
      this.#frame.setAttribute('aria-label', CONFIRM.asks[ask].title)
    }
    this.#ask = ask
    this.#set(ask !== undefined)
  }

  /** Answer the question in front of the player. Nothing to answer is not an answer. */
  answer(yes: boolean): boolean {
    const ask = this.#ask
    if (!ask) return false
    this.#answer(ask, yes)
    return true
  }

  /** Keep Tab on the two answers while the question is up. */
  trap(back: boolean): boolean {
    return this.#reveal.open && trapTab(this.#frame, back)
  }

  dispose(): void {
    this.#reveal.dispose()
  }

  #set(open: boolean): void {
    if (open === this.#reveal.open) return
    if (open) this.#focus.remember(this.#frame)
    this.#reveal.set(open)
    // Yes takes the ring because Enter is yes: what the keyboard would do and
    // what the ring is on are never two different answers.
    if (open) this.#yes.focus()
    else this.#focus.restore(this.#frame)
  }
}
