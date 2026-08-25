import { el, setText } from '../dom.ts'
import { rise } from '../motion.ts'
import { COUNTER, priceText } from '../phrase.ts'
import type { CounterOffer, CounterView, HudIntent, HudState } from '../types.ts'
import { act } from '../ui/act.ts'
import { Count } from '../ui/count.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { Row } from '../ui/row.ts'
import type { Surface } from './surface.ts'
import { HudWindow } from './window.ts'

/**
 * A counter the player is standing at: who keeps it, what is on it at what
 * price, and what the player has to spend on a plate in the head. Buying is an
 * intent the game acts on; the counter draws what is pushed back, so a thing
 * sold is gone on the next push and never taken off here. What costs more than
 * the player holds stays on the counter to read, warned, with its button off,
 * so they know what to come back for.
 *
 * After a sale the credits count down to what is left rather than jumping.
 */
export class CounterSurface implements Surface {
  #window: HudWindow
  #seller = el('h3')
  #credits = new Count()
  #list = el('ul', 'gb-offers gb-rows')
  #emit: (intent: HudIntent) => void
  #key: string | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    const purse = el('p', 'gb-plate-credits gb-cut gb-edged')
    purse.setAttribute('aria-label', COUNTER.credits)
    this.#credits.node.classList.add('gb-t4')
    purse.append(icon('credit', ICON_PX.button), el('span', 'gb-t1', COUNTER.credits), this.#credits.node)
    this.#window = new HudWindow({
      lead: this.#seller,
      mark: 'counter',
      aside: purse,
      className: 'gb-counter',
      onClose: () => emit({ kind: 'counter-closed' }),
      onClosed: () => this.#clear(),
    })
    this.#window.node.classList.add('gb-counter-room')
    this.#window.body.append(this.#list)
  }

  get node(): HTMLElement {
    return this.#window.node
  }

  render(state: HudState): void {
    const counter = state.counter
    if (counter) this.#draw(counter, state.money)
    this.#window.set(counter !== undefined)
  }

  trap(back: boolean): boolean {
    return this.#window.trap(back)
  }

  dispose(): void {
    this.#credits.dispose()
    this.#window.dispose()
  }

  #draw(counter: CounterView, money: number): void {
    const key = JSON.stringify([counter, money])
    if (key === this.#key) return
    this.#key = key
    setText(this.#seller, counter.seller)
    this.#window.label(counter.seller)
    this.#credits.set(money)
    this.#list.replaceChildren(
      ...(counter.offers.length
        ? counter.offers.map((offer, at) => this.#offer(offer, money, at))
        : [el('li', 'gb-empty gb-t3', COUNTER.none)]),
    )
  }

  #offer(offer: CounterOffer, money: number, at: number): HTMLElement {
    const short = offer.price > money
    const row = new Row({ icon: 'item', title: offer.name, tag: 'li', className: 'gb-offer' })
    row.node.dataset.short = String(short)
    const price = el('span', 'gb-num gb-t4 gb-price', priceText(offer.price))
    row.state.append(price)
    const buy = act({
      label: COUNTER.buy,
      lit: true,
      aria: `${COUNTER.buy} ${offer.name}, ${priceText(offer.price)}${short ? `, ${COUNTER.short.toLowerCase()}` : ''}`,
    })
    buy.disabled = short
    buy.addEventListener('click', () => this.#emit({ kind: 'buy', itemId: offer.id }))
    row.act(buy)
    rise(row.node, at)
    return row.node
  }

  #clear(): void {
    this.#key = null
    setText(this.#seller, '')
    this.#credits.reset()
    this.#list.replaceChildren()
  }
}
