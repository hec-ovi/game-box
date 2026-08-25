import { HUD_KEYS } from '../controls.ts'
import { el, keyButton } from '../dom.ts'
import { FocusReturn, trapTab } from '../focus.ts'
import { Reveal } from '../reveal.ts'

/**
 * The chrome the window shares whatever is inside it: a frame of one fixed
 * size centred in the room the corners leave, a head with whatever names the
 * contents, a close button with its key written on it, a body that scrolls,
 * and the manners that go with taking the keyboard. It arrives and leaves on
 * a transition, keeps Tab inside itself while it is up, and hands focus back
 * to wherever it came from on the way out.
 */
export class HudWindow {
  /** The room the frame is centred in. Clicks beside the frame fall through. */
  readonly node = el('div', 'gb-window-room')
  readonly frame = el('section', 'gb-window gb-bracket')
  readonly body = el('div', 'gb-window-body')
  #reveal: Reveal
  #focus = new FocusReturn()

  constructor(input: { lead: HTMLElement; className?: string; onClose: () => void; onClosed?: () => void }) {
    if (input.className) this.frame.classList.add(input.className)
    this.frame.setAttribute('role', 'dialog')
    this.frame.setAttribute('aria-modal', 'true')
    this.frame.tabIndex = -1

    const close = keyButton('gb-close', 'Close', HUD_KEYS.close, 'Close (Escape)')
    close.addEventListener('click', input.onClose)

    const head = el('header', 'gb-window-head')
    head.append(input.lead, close)
    this.frame.append(head, this.body)
    this.node.append(this.frame)

    this.#reveal = new Reveal(this.frame, {
      ...(input.onClosed ? { onClosed: input.onClosed } : {}),
    })
  }

  /** What a screen reader calls the window: whichever face of it is up. */
  label(text: string): void {
    this.frame.setAttribute('aria-label', text)
  }

  set(open: boolean): void {
    if (open === this.#reveal.open) return
    if (open) this.#focus.remember(this.frame)
    this.#reveal.set(open)
    if (open) this.frame.focus()
    else this.#focus.restore(this.frame)
  }

  /** Keep Tab in here while the window is up. */
  trap(back: boolean): boolean {
    return this.#reveal.open && trapTab(this.frame, back)
  }

  dispose(): void {
    this.#reveal.dispose()
  }
}
