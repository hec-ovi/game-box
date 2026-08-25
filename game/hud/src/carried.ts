import { el } from './dom.ts'
import { rise } from './motion.ts'
import { priceText } from './phrase.ts'
import type { Carried } from './types.ts'
import { chip } from './ui/chip.ts'
import { Row } from './ui/row.ts'

/** What a live quest wants reads first: it is the thing not to sell or drop. */
function questFirst(carrying: readonly Carried[]): readonly Carried[] {
  return [...carrying].sort((a, b) => Number(Boolean(b.quest)) - Number(Boolean(a.quest)))
}

/** One thing as a row: its tile, its name, the quest chip when a quest wants it, its value. */
function carriedRow(item: Carried, at: number): HTMLElement {
  const row = new Row({ icon: 'item', title: item.name, tag: 'li', compact: true })
  if (item.quest) {
    row.keyLine('on')
    row.state.append(chip('Quest', 'accent'))
  }
  if (item.value !== undefined) {
    row.state.append(el('span', 'gb-value gb-num gb-t2', priceText(item.value)))
  }
  rise(row.node, at)
  return row.node
}

/** A list of things, quest items first; one quiet line when there are none. */
export function carriedList(items: readonly Carried[], className: string, empty: string): HTMLUListElement {
  const list = el('ul', `${className} gb-rows`)
  const order = questFirst(items)
  list.replaceChildren(...(order.length ? order.map(carriedRow) : [el('li', 'gb-empty gb-t3', empty)]))
  return list
}
