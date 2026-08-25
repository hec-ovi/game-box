import { setText } from './dom.ts'

/** "1:32", "0:07": minutes and seconds, never negative. */
export function clockText(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * A number of seconds written into one node and counted down one second per
 * real second. `set` restarts it from a fresh value, so a push from the game
 * corrects it and nothing between pushes drifts for long.
 */
export class Countdown {
  #node: HTMLElement
  #seconds = 0
  #timer: ReturnType<typeof setInterval> | undefined

  constructor(node: HTMLElement) {
    this.#node = node
  }

  set(seconds: number): void {
    this.#seconds = seconds
    this.#write()
    this.dispose()
    this.#timer = setInterval(() => this.#tick(), 1000)
  }

  dispose(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer)
    this.#timer = undefined
  }

  #tick(): void {
    this.#seconds = Math.max(0, this.#seconds - 1)
    this.#write()
    if (this.#seconds === 0) this.dispose()
  }

  #write(): void {
    setText(this.#node, clockText(this.#seconds))
  }
}
