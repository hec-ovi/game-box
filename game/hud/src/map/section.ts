import { el } from '../dom.ts'
import { ICON_PX, icon, type IconName } from '../ui/icon.ts'

/**
 * One heading on the map's right hand column, with everything under it folded
 * away or open. Which way it stands is the interface's own: the game says what
 * is in the list, the player says whether they are reading it.
 */
export class Section {
  readonly node = el('section', 'gb-map-section')
  readonly body = el('div', 'gb-map-section-body')
  #head = el('button', 'gb-map-section-head gb-cut')
  #count = el('span', 'gb-num gb-t1 gb-map-section-count')
  #open = true

  constructor(input: { title: string; icon: IconName; onToggle: (open: boolean) => void }) {
    this.#head.type = 'button'
    this.#head.append(
      el('span', 'gb-map-section-chevron', ''),
      icon(input.icon, ICON_PX.button),
      el('span', 'gb-t1 gb-map-section-title', input.title),
      this.#count,
    )
    this.#head.querySelector('.gb-map-section-chevron')!.append(icon('chevron-down', ICON_PX.line))
    this.#head.addEventListener('click', () => input.onToggle(!this.#open))
    this.node.append(this.#head, this.body)
    this.open = true
  }

  /** How many things are under the heading. Nothing written where a count would say nothing. */
  count(text: string | null): void {
    this.#count.textContent = text ?? ''
    this.#count.hidden = text === null
  }

  set open(open: boolean) {
    this.#open = open
    this.#head.setAttribute('aria-expanded', String(open))
    this.body.hidden = !open
    this.node.dataset.open = String(open)
  }

  get open(): boolean {
    return this.#open
  }
}
