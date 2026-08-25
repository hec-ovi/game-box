import { el } from '../dom.ts'
import { MAIN_TAG, NO_BEARINGS } from '../phrase.ts'
import type { QuestKind } from '@gb/quest'

/** One place to head for, and where on the plan it is when the plan has it. */
export interface Bearing {
  readonly text: string
  readonly note: string | undefined
  readonly line: QuestKind | undefined
  readonly at: { x: number; y: number } | undefined
}

/**
 * The places to head for, under the plan: the story's marked, an errand's
 * plain, and each one a button that swings the plan onto it when the plan
 * knows where it is. With nothing to head for it says so.
 */
export class Legend {
  readonly node = el('section', 'gb-bearing-list')
  #list = el('ol', 'gb-bearings')
  #find: (at: { x: number; y: number }) => void
  #key: string | null = null

  constructor(find: (at: { x: number; y: number }) => void) {
    this.#find = find
    this.node.append(el('h3', undefined, 'Bearings'), this.#list)
  }

  set(bearings: readonly Bearing[]): void {
    const key = bearings.map((line) => `${line.line ?? ''}:${line.text}:${line.note ?? ''}:${line.at ? 'at' : ''}`).join('|')
    if (key === this.#key) return
    this.#key = key
    this.#list.replaceChildren(...(bearings.length ? bearings.map((line) => this.#row(line)) : [el('li', 'gb-empty', NO_BEARINGS)]))
  }

  clear(): void {
    this.#key = null
    this.#list.replaceChildren()
  }

  #row(line: Bearing): HTMLLIElement {
    const node = el('li')
    node.dataset.line = line.line ?? 'side'
    const what = el('span', 'gb-what', line.text)
    if (line.at) {
      const at = line.at
      const go = el('button', 'gb-bearing', line.text)
      go.type = 'button'
      go.addEventListener('click', () => this.#find(at))
      what.replaceChildren(go)
    }
    if (line.line === 'main') node.append(el('span', 'gb-tag gb-main', MAIN_TAG))
    node.append(what)
    if (line.note) node.append(el('span', 'gb-note', line.note))
    return node
  }
}
