import { carriedList } from '../carried.ts'
import { el } from '../dom.ts'
import { HOMES } from '../phrase.ts'
import type { OwnedPlace } from '../types.ts'

/**
 * The places the player owns and what they have left in each, under the
 * things in hand. A place with nothing in it says so, and so does a player
 * with no place yet, so the section never reads as a gap.
 */
export function homesSection(homes: readonly OwnedPlace[]): HTMLElement {
  const node = el('section', 'gb-homes')
  node.append(el('h3', undefined, HOMES.head))
  if (homes.length === 0) {
    node.append(el('p', 'gb-empty', HOMES.none))
    return node
  }
  const list = el('ul', 'gb-home-list')
  list.append(...homes.map(home))
  node.append(list)
  return node
}

function home(place: OwnedPlace): HTMLLIElement {
  const node = el('li', 'gb-home')
  node.append(el('h4', undefined, place.name))
  if (place.text) node.append(el('p', undefined, place.text))
  node.append(carriedList(place.placed, 'gb-carried gb-placed', HOMES.empty))
  return node
}
