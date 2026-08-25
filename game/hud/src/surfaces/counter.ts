import { el, setText } from '../dom.ts'
import { COUNTER, priceText } from '../phrase.ts'
import type { CounterOffer, CounterView, HudIntent, HudState } from '../types.ts'
import type { Surface } from './surface.ts'
import { HudWindow } from './window.ts'

/**
 * A counter the player is standing at: who keeps it, what is on it at what
 * price, and what the player has to spend. Buying is an intent the game acts
 * on; the counter draws what is pushed back, so a thing sold is gone on the
 * next push and never taken off here. What costs more than the player holds
 * stays on the counter to read, with its button off, so they know what to
 * come back for.
 */
export class CounterSurface implements Surface {
  #window: HudWindow
  #seller = el('h3', 'gb-counter-seller')
  #credits = el('span', 'gb-num')
  #list = el('ul', 'gb-offers')
  #emit: (intent: HudIntent) => void
  #key: string | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.#window = new HudWindow({
      lead: this.#seller,
      className: 'gb-counter',
      onClose: () => emit({ kind: 'counter-closed' }),
      onClosed: () => this.#clear(),
    })
    this.#window.node.classList.add('gb-counter-room')
    const purse = el('p', 'gb-counter-credits')
    purse.append(el('span', 'gb-label', COUNTER.credits), this.#credits)
    this.#window.body.append(purse, this.#list)
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
    this.#window.dispose()
  }

  #draw(counter: CounterView, money: number): void {
    const key = JSON.stringify([counter, money])
    if (key === this.#key) return
    this.#key = key
    setText(this.#seller, counter.seller)
    this.#window.label(counter.seller)
    setText(this.#credits, String(money))
    this.#list.replaceChildren(
      ...(counter.offers.length ? counter.offers.map((offer) => this.#offer(offer, money)) : [el('li', 'gb-empty', COUNTER.none)]),
    )
  }

  #offer(offer: CounterOffer, money: number): HTMLLIElement {
    const row = el('li', 'gb-offer')
    const short = offer.price > money
    row.dataset.short = String(short)
    const buy = el('button', 'gb-buy', COUNTER.buy)
    buy.type = 'button'
    buy.disabled = short
    buy.setAttribute('aria-label', `${COUNTER.buy} ${offer.name}, ${priceText(offer.price)}${short ? `, ${COUNTER.short.toLowerCase()}` : ''}`)
    buy.addEventListener('click', () => this.#emit({ kind: 'buy', itemId: offer.id }))
    row.append(el('span', 'gb-what', offer.name), el('span', 'gb-num gb-price', priceText(offer.price)), buy)
    return row
  }

  #clear(): void {
    this.#key = null
    setText(this.#seller, '')
    setText(this.#credits, '')
    this.#list.replaceChildren()
  }
}
