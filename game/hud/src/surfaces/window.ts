import { HUD_KEYS } from '../controls.ts'
import { el } from '../dom.ts'
import { FocusReturn, trapTab } from '../focus.ts'
import { Reveal } from '../reveal.ts'
import { closeButton } from '../ui/act.ts'
import { ICON_PX, icon, type IconName } from '../ui/icon.ts'

/**
 * The chrome the window shares whatever is inside it: a frame of one fixed
 * size centred in the room the corners leave, a title head with the close
 * button and its key, whatever strip belongs under the head, a body that
 * scrolls, and the manners that go with taking the keyboard.
 *
 * It rises into place and settles back out, keeps Tab inside itself while it
 * is up, and hands focus back to wherever it came from on the way out.
 */
export class HudWindow {
  /** The room the frame is centred in. Clicks beside the frame fall through. */
  readonly node = el('div', 'gb-window-room')
  readonly frame = el('section', 'gb-window gb-frame gb-cut gb-edged')
  readonly body = el('div', 'gb-window-body gb-scrolls')
  #reveal: Reveal
  #focus = new FocusReturn()

  constructor(input: {
    lead: HTMLElement
    /** The picture beside the title, where the frame has one. */
    mark?: IconName
    /** What sits at the right of the head, before the close button: a readout, a plate. */
    aside?: HTMLElement
    strip?: HTMLElement
    className?: string
    onClose: () => void
    onClosed?: () => void
  }) {
    if (input.className) this.frame.classList.add(input.className)
    this.frame.setAttribute('role', 'dialog')
    this.frame.setAttribute('aria-modal', 'true')
    this.frame.tabIndex = -1

    const close = closeButton(HUD_KEYS.close, 'Close (Escape)')
    close.addEventListener('click', input.onClose)

    input.lead.classList.add('gb-head-name', 'gb-t6')
    const head = el('header', 'gb-head gb-head-tall')
    if (input.mark) head.append(icon(input.mark, ICON_PX.tile))
    head.append(input.lead)
    if (input.aside) head.append(input.aside)
    head.append(close)
    this.frame.append(head)
    if (input.strip) this.frame.append(input.strip)
    this.frame.append(this.body, el('span', 'gb-ticks'))
    this.node.append(this.frame)

    this.#reveal = new Reveal(this.frame, {
      kind: 'frame',
      onClosed: () => {
        input.onClosed?.()
      },
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
