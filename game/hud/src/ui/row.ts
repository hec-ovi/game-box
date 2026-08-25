import { el, kbd, setText } from '../dom.ts'
import { ICON_PX, icon, type IconName } from './icon.ts'

/** The accent tab down the left edge of a row: what this row is, in one stroke. */
export type RowLine = 'main' | 'on' | 'bad' | null

export interface RowInput {
  readonly icon: IconName
  readonly title: string
  readonly line?: string | undefined
  /** A short row: settings, controls, bearings, stations. */
  readonly compact?: boolean
  readonly tag?: 'li' | 'div' | 'article'
  readonly className?: string
}

/**
 * The one row the whole interface is built from: an icon tile, a title over a
 * supporting line, what state it is in, what can be done about it, and the key
 * that does the same thing.
 *
 * A row with nothing to do is not a button and does not answer the pointer,
 * so `act` is what marks a row as something the player can use.
 */
export class Row {
  readonly node: HTMLElement
  readonly tile: HTMLElement
  readonly state = el('div', 'gb-row-state')
  readonly acts = el('div', 'gb-row-acts')
  /** The title cell. A row whose title is what the player clicks puts its button in here. */
  readonly titleCell = el('div', 'gb-row-title gb-t4 gb-clip')
  #line = el('div', 'gb-row-line gb-t2 gb-clip')

  constructor(input: RowInput) {
    const size = input.compact ? ICON_PX.button : ICON_PX.tile
    this.node = el(
      input.tag ?? 'div',
      ['gb-row gb-cut', input.compact ? 'gb-row-compact' : '', input.className ?? ''].join(' ').trim(),
    )
    this.tile = el('div', `gb-tile gb-cut gb-edged${input.compact ? ' gb-tile-sm' : ''}`)
    this.tile.append(icon(input.icon, size))
    const text = el('div', 'gb-row-text')
    text.append(this.titleCell, this.#line)
    this.node.append(this.tile, text, this.state, this.acts)
    this.says(input.title, input.line ?? null)
  }

  /** The title, and the one line under it. `null` takes the line away. */
  says(title: string, line: string | null = null): void {
    setText(this.titleCell, title)
    setText(this.#line, line ?? '')
    this.#line.hidden = !line
  }

  keyLine(line: RowLine): void {
    if (line) this.node.dataset.line = line
    else delete this.node.dataset.line
  }

  /** The row the player is following, or reading. */
  chosen(on: boolean): void {
    this.node.dataset.on = String(on)
  }

  done(on: boolean): void {
    this.node.dataset.done = String(on)
  }

  /** Something to do here, which is what makes the row answer the pointer. */
  act(button: HTMLButtonElement): void {
    if (!button.disabled) this.node.dataset.acts = 'true'
    this.acts.append(button)
  }

  /** The key that does what the row does, at its right edge. */
  key(key: string): void {
    this.acts.append(kbd(key))
  }
}
