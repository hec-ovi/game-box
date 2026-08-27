import { el } from '../dom.ts'
import { WAITING_TAG, foundAt } from '../phrase.ts'
import type { WorkOffer } from '../types.ts'
import { chip } from '../ui/chip.ts'
import { Row } from '../ui/row.ts'

/**
 * A job nobody has taken yet: its own name over whose door it is and the place
 * they keep, so the player reads where to go and get it. Picking the row is
 * picking that door on the city, which is why it reports the mark's handle and
 * not the quest's.
 */
export function offerRow(offer: WorkOffer, reading: string | undefined, read: (targetId: string) => void): HTMLElement {
  const main = offer.line === 'main'
  const row = new Row({
    icon: main ? 'quest-main' : 'quest-side',
    title: offer.title,
    line: foundAt(offer.giver, offer.place),
    compact: true,
  })
  row.chosen(offer.id === reading)
  row.keyLine(main ? 'main' : offer.id === reading ? 'on' : null)
  row.state.append(chip(WAITING_TAG))
  const pick = el('button', 'gb-map-pick', offer.title)
  pick.type = 'button'
  pick.addEventListener('click', () => read(offer.id))
  row.titleCell.replaceChildren(pick)
  row.node.dataset.acts = 'true'
  return row.node
}
