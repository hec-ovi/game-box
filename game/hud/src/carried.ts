import { el } from './dom.ts'
import { priceText } from './phrase.ts'
import type { Carried } from './types.ts'

/** What a live quest wants reads first: it is the thing not to sell or drop. */
function questFirst(carrying: readonly Carried[]): readonly Carried[] {
  return [...carrying].sort((a, b) => Number(Boolean(b.quest)) - Number(Boolean(a.quest)))
}

/** One thing as a row: its mark, its name, the quest tag when a quest wants it, its value when it has one. */
function carriedRow(item: Carried): HTMLLIElement {
  const node = el('li', item.quest ? 'gb-quest-item' : undefined)
  node.append(el('span', 'gb-mark', item.quest ? '◆' : '·'), el('span', 'gb-what', item.name))
  if (item.quest) node.append(el('span', 'gb-tag', 'Quest'))
  if (item.value !== undefined) node.append(el('span', 'gb-num gb-value', priceText(item.value)))
  return node
}

/** A list of things, quest items first; one quiet line when there are none. */
export function carriedList(items: readonly Carried[], className: string, empty: string): HTMLUListElement {
  const list = el('ul', className)
  const order = questFirst(items)
  list.replaceChildren(...(order.length ? order.map(carriedRow) : [el('li', 'gb-empty', empty)]))
  return list
}
