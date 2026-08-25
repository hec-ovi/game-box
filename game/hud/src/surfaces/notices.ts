import { Countdown } from '../countdown.ts'
import { el } from '../dom.ts'
import { BUSY, phrase } from '../phrase.ts'
import type { HudState, LiveNotice } from '../types.ts'
import type { Surface } from './surface.ts'

/**
 * Everything that just happened. A finished quest lands large and stays;
 * picking up a bottle is a quiet line that is gone before it is in the way.
 * Cards keep their node for as long as they live, so nothing restarts
 * mid-leave, and a wait counts itself down inside its own card.
 *
 * A notice enters from the left edge and leaves the same way. As one goes, the
 * ones under it are put back where they were and slid up by transform, so the
 * column closes rather than jumping.
 */
export class NoticesSurface implements Surface {
  readonly node = el('section', 'gb-notices')
  #cards = new Map<number, Card>()

  constructor() {
    this.node.setAttribute('role', 'status')
    this.node.setAttribute('aria-live', 'polite')
    this.node.hidden = true
  }

  render(state: HudState): void {
    const live = new Set<number>()
    for (const notice of state.notices) {
      live.add(notice.id)
      let card = this.#cards.get(notice.id)
      if (!card) {
        card = new Card(notice)
        this.#cards.set(notice.id, card)
        this.node.append(card.node)
      }
      card.node.dataset.leaving = String(notice.leaving)
    }
    const going = [...this.#cards].filter(([id]) => !live.has(id))
    if (going.length) {
      const was = this.#tops()
      for (const [id, card] of going) {
        card.dispose()
        this.#cards.delete(id)
      }
      this.#close(was)
    }
    this.node.hidden = state.notices.length === 0
  }

  dispose(): void {
    for (const card of this.#cards.values()) card.dispose()
    this.#cards.clear()
  }

  #tops(): Map<number, number> {
    return new Map([...this.#cards].map(([id, card]) => [id, card.node.offsetTop]))
  }

  /** Put what is left back where it was, then let it slide up on its own. */
  #close(was: Map<number, number>): void {
    for (const [id, card] of this.#cards) {
      const from = was.get(id)
      const shift = from === undefined ? 0 : from - card.node.offsetTop
      if (shift <= 0) continue
      card.node.style.transform = `translateY(${shift}px)`
      void card.node.offsetWidth
      card.node.style.transform = ''
    }
  }
}

class Card {
  readonly node: HTMLElement
  #countdown: Countdown | undefined

  constructor(live: LiveNotice) {
    const said = phrase(live.notice)
    this.node = el('div', `gb-notice gb-${live.notice.kind} gb-cut gb-edged ${said.tone === 'major' ? 'gb-t5' : 'gb-t2'}`)
    this.node.dataset.tone = said.tone
    if (said.mood) this.node.dataset.mood = said.mood
    // Coin arriving and coin leaving read differently at a glance.
    if (live.notice.kind === 'money') this.node.dataset.sign = live.notice.delta > 0 ? 'up' : 'down'
    this.node.append(el('span', 'gb-what', said.text))
    if (said.detail) this.node.append(el('span', 'gb-detail gb-num gb-t2', said.detail))
    if (live.notice.kind === 'model-busy') {
      const clock = el('span', 'gb-num')
      this.#countdown = new Countdown(clock)
      this.#countdown.set(live.notice.retryIn)
      const detail = el('span', 'gb-detail', `${BUSY.retry} `)
      detail.append(clock)
      this.node.append(detail)
    }
  }

  dispose(): void {
    this.#countdown?.dispose()
    this.node.remove()
  }
}
