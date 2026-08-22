import { el } from '../dom.ts'
import { phrase } from '../phrase.ts'
import type { HudState, LiveNotice } from '../types.ts'
import type { Surface } from './surface.ts'

/**
 * Everything that just happened: a quest started, a step done, money changing.
 * Same mechanism as the panels, only the state behind it expires on its own.
 */
export class NoticesSurface implements Surface {
  readonly node = el('section', 'gb-notices')
  #key: string | null = null

  constructor() {
    this.node.setAttribute('role', 'status')
    this.node.setAttribute('aria-live', 'polite')
    this.node.hidden = true
  }

  render(state: HudState): void {
    const key = state.notices.map((n) => n.id).join('|')
    if (key === this.#key) return
    this.#key = key
    this.node.hidden = state.notices.length === 0
    this.node.replaceChildren(...state.notices.map(card))
  }
}

function card(live: LiveNotice): HTMLDivElement {
  const said = phrase(live.notice)
  const node = el('div', `gb-notice gb-${live.notice.kind}`)
  node.append(el('span', 'gb-what', said.text))
  if (said.detail) node.append(el('span', 'gb-detail', said.detail))
  return node
}
