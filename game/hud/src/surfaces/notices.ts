import { el } from '../dom.ts'
import { phrase } from '../phrase.ts'
import type { HudState, LiveNotice } from '../types.ts'
import type { Surface } from './surface.ts'

/**
 * Everything that just happened. A finished quest lands loud and stays; picking
 * up a bottle is a quiet line that is gone before it is in the way. Cards keep
 * their node for as long as they live, so nothing restarts mid-fade.
 */
export class NoticesSurface implements Surface {
  readonly node = el('section', 'gb-notices')
  #cards = new Map<number, HTMLElement>()

  constructor() {
    this.node.setAttribute('role', 'status')
    this.node.setAttribute('aria-live', 'polite')
    this.node.hidden = true
  }

  render(state: HudState): void {
    const live = new Set<number>()
    for (const notice of state.notices) {
      live.add(notice.id)
      let node = this.#cards.get(notice.id)
      if (!node) {
        node = card(notice)
        this.#cards.set(notice.id, node)
        this.node.append(node)
      }
      node.dataset.leaving = String(notice.leaving)
    }
    for (const [id, node] of this.#cards) {
      if (live.has(id)) continue
      node.remove()
      this.#cards.delete(id)
    }
    this.node.hidden = state.notices.length === 0
  }
}

function card(live: LiveNotice): HTMLElement {
  const said = phrase(live.notice)
  const node = el('div', `gb-notice gb-${live.notice.kind}`)
  node.dataset.tone = said.tone
  node.append(el('span', 'gb-what', said.text))
  if (said.detail) node.append(el('span', 'gb-detail', said.detail))
  return node
}
