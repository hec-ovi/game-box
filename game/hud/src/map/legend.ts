import type { QuestKind } from '@gb/quest'
import { el } from '../dom.ts'
import { rise } from '../motion.ts'
import { NO_BEARINGS } from '../phrase.ts'
import { mainChip } from '../ui/chip.ts'
import { Row } from '../ui/row.ts'

/** One place to head for, and where on the plan it is when the plan has it. */
export interface Bearing {
  readonly text: string
  readonly note: string | undefined
  readonly line: QuestKind | undefined
  readonly at: { x: number; y: number } | undefined
}

/**
 * The places to head for, under the plan: the story marked in brass, an errand
 * plain, and each one a button that swings the plan onto it when the plan
 * knows where it is. With nothing to head for it says so.
 */
export class Legend {
  readonly node = el('section', 'gb-bearing-list gb-scrolls')
  #list = el('ol', 'gb-bearings gb-rows')
  #find: (at: { x: number; y: number }) => void
  #key: string | null = null

  constructor(find: (at: { x: number; y: number }) => void) {
    this.#find = find
    this.node.append(el('h3', 'gb-t1', 'Bearings'), this.#list)
  }

  set(bearings: readonly Bearing[]): void {
    const key = bearings.map((line) => `${line.line ?? ''}:${line.text}:${line.note ?? ''}:${line.at ? 'at' : ''}`).join('|')
    if (key === this.#key) return
    this.#key = key
    this.#list.replaceChildren(
      ...(bearings.length
        ? bearings.map((line, at) => this.#row(line, at))
        : [el('li', 'gb-empty gb-t3', NO_BEARINGS)]),
    )
  }

  clear(): void {
    this.#key = null
    this.#list.replaceChildren()
  }

  #row(line: Bearing, index: number): HTMLLIElement {
    const main = line.line === 'main'
    const row = new Row({
      icon: main ? 'diamond' : 'ring',
      title: line.text,
      line: line.note,
      tag: 'li',
      compact: true,
    })
    row.node.dataset.line = main ? 'main' : 'side'
    if (main) {
      row.tile.classList.add('gb-tile-main')
      row.state.append(mainChip())
    }
    if (line.at) {
      const at = line.at
      const go = el('button', 'gb-bearing', line.text)
      go.type = 'button'
      go.addEventListener('click', () => this.#find(at))
      row.titleCell.replaceChildren(go)
      row.node.dataset.acts = 'true'
    }
    rise(row.node, index)
    return row.node as HTMLLIElement
  }
}
