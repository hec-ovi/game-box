import { el, kbd, setText } from '../dom.ts'

/**
 * "9 more quests", with the key that opens the place they are all listed. A
 * corner panel shows what the player needs at a glance and points at the rest
 * rather than growing down the screen.
 */
export class MoreLine {
  readonly node = el('p', 'gb-more gb-t2')
  #text = el('span')

  constructor(key: string) {
    this.node.append(this.#text, kbd(key))
    this.node.hidden = true
  }

  /** `null` when there is no rest to point at. */
  set(text: string | null): void {
    setText(this.#text, text ?? '')
    this.node.hidden = text === null
  }
}
