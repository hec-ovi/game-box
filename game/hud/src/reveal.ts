/** How long a panel takes to arrive or leave. Long enough to read, short enough
 * to never be in the way. */
export const REVEAL_MS = 150

/**
 * A panel that arrives and leaves instead of blinking. It is closed the moment
 * `set(false)` is called: it stops taking clicks, drops out of the accessible
 * tree and answers `open` as false. Only the pixels linger, for one transition,
 * so the key that closes one window is free to open the next in the same breath.
 */
export class Reveal {
  readonly node: HTMLElement
  #open = false
  #ms: number
  #onClosed: (() => void) | undefined
  #timer: ReturnType<typeof setTimeout> | undefined

  constructor(node: HTMLElement, options: { ms?: number; onClosed?: () => void } = {}) {
    this.node = node
    this.#ms = options.ms ?? REVEAL_MS
    this.#onClosed = options.onClosed
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
    this.node.dataset.state = 'opening'
    // Flush the closed state so the browser has something to transition from.
    void this.node.offsetHeight
    this.node.dataset.state = 'open'
  }

  #leave(): void {
    this.node.setAttribute('aria-hidden', 'true')
    this.node.dataset.state = 'closing'
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      this.node.hidden = true
      this.node.dataset.state = 'closed'
      this.#onClosed?.()
    }, this.#ms)
  }

  dispose(): void {
    clearTimeout(this.#timer)
    this.#timer = undefined
  }
}
