import { HUD_KEYS } from '../controls.ts'
import { el, keyButton } from '../dom.ts'
import { FocusReturn, trapTab } from '../focus.ts'
import { Reveal } from '../reveal.ts'

/**
 * The chrome every window in the interface shares: a title, a close button with
 * its key written on it, a body, and the manners that go with taking the
 * keyboard. It arrives and leaves on a transition, keeps Tab inside itself
 * while it is up, and hands focus back to wherever it came from on the way out.
 */
export class HudWindow {
  readonly node: HTMLElement
  readonly body = el('div', 'gb-window-body')
  #reveal: Reveal
  #focus = new FocusReturn()

  constructor(input: { className: string; title: string; onClose: () => void; onClosed?: () => void }) {
    this.node = el('section', `gb-window ${input.className}`)
    this.node.setAttribute('role', 'dialog')
    this.node.setAttribute('aria-modal', 'true')
    this.node.setAttribute('aria-label', input.title)
    this.node.tabIndex = -1

    const close = keyButton('gb-close', 'Close', HUD_KEYS.close, `Close ${input.title.toLowerCase()} (Escape)`)
    close.addEventListener('click', input.onClose)

    const head = el('header', 'gb-window-head')
    head.append(el('h2', undefined, input.title), close)
    this.node.append(head, this.body)

    this.#reveal = new Reveal(this.node, {
      ...(input.onClosed ? { onClosed: input.onClosed } : {}),
    })
  }

  get open(): boolean {
    return this.#reveal.open
  }

  set(open: boolean): void {
    if (open === this.#reveal.open) return
    if (open) this.#focus.remember(this.node)
    this.#reveal.set(open)
    if (open) this.node.focus()
    else this.#focus.restore(this.node)
  }

  /** Keep Tab in here while the window is up. */
  trap(back: boolean): boolean {
    return this.#reveal.open && trapTab(this.node, back)
  }

  dispose(): void {
    this.#reveal.dispose()
  }
}
