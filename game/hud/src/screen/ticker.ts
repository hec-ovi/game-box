/** A game clock: one call per period while it runs, and nothing after `stop`. */
export class Ticker {
  #ms: number
  #tick: () => void
  #timer: ReturnType<typeof setInterval> | undefined

  constructor(ms: number, tick: () => void) {
    this.#ms = ms
    this.#tick = tick
  }

  start(): void {
    if (this.#timer !== undefined) return
    this.#timer = setInterval(this.#tick, this.#ms)
  }

  stop(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer)
    this.#timer = undefined
  }
}
