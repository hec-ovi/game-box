import { MS, reducedMotion } from './motion.ts'

/** Which way a surface arrives and leaves. The stylesheet reads this off the node. */
export type RevealKind = 'frame' | 'side' | 'corner' | 'prompt' | 'notice' | 'fade' | 'veil'

/**
 * A panel that arrives and leaves instead of blinking. It is closed the moment
 * `set(false)` is called: it stops taking clicks, drops out of the accessible
 * tree and answers `open` as false. Only the pixels linger, for one leave, so
 * the key that closes one window is free to open the next in the same breath.
 *
 * It tells the browser what is about to move and takes that back when it
 * stops, so a panel standing still costs nothing over a scene drawing every
 * frame. Asked for less movement, it swaps places with no transition at all.
 */
export class Reveal {
  readonly node: HTMLElement
  #open = false
  #onClosed: (() => void) | undefined
  #timer: ReturnType<typeof setTimeout> | undefined

  constructor(node: HTMLElement, options: { kind?: RevealKind; onClosed?: () => void } = {}) {
    this.node = node
    this.#onClosed = options.onClosed
    node.dataset.reveal = options.kind ?? 'frame'
    node.hidden = true
    node.setAttribute('aria-hidden', 'true')
    node.dataset.state = 'closed'
  }

  get open(): boolean {
    return this.#open
  }

  set(open: boolean): void {
    if (open === this.#open) return
    this.#open = open
    clearTimeout(this.#timer)
    this.#timer = undefined
    if (open) this.#enter()
    else this.#leave()
  }

  #enter(): void {
    this.node.hidden = false
    this.node.removeAttribute('aria-hidden')
    this.node.style.willChange = 'transform, opacity'
    this.node.dataset.state = 'opening'
    // Flush the closed state so the browser has something to transition from.
    void this.node.offsetHeight
    this.node.dataset.state = 'open'
    this.#after(this.#ms(MS.enter), () => {
      this.node.style.removeProperty('will-change')
    })
  }

  #leave(): void {
    this.node.setAttribute('aria-hidden', 'true')
    this.node.style.willChange = 'transform, opacity'
    this.node.dataset.state = 'closing'
    this.#after(this.#ms(MS.leave), () => {
      this.node.hidden = true
      this.node.dataset.state = 'closed'
      this.node.style.removeProperty('will-change')
      this.#onClosed?.()
    })
  }

  dispose(): void {
    clearTimeout(this.#timer)
    this.#timer = undefined
  }

  /** How long the pixels linger: the veil's own time, or none at all when the
   * player asked for less movement. */
  #ms(normal: number): number {
    if (reducedMotion(this.node)) return 0
    return this.node.dataset.reveal === 'veil' ? MS.veil : normal
  }

  #after(ms: number, run: () => void): void {
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      run()
    }, ms)
  }
}
