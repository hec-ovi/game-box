import { el, setText } from '../dom.ts'
import { MS, reducedMotion } from '../motion.ts'

/** Under this much of a change there is nothing to watch, so it snaps. */
const SNAP = 3

/**
 * A number that counts to its new value instead of jumping to it: credits
 * paid out, credits spent. It is written in mono with tabular figures, so
 * nothing beside it moves while it runs.
 *
 * The first value it is given snaps: a panel opening should read what is
 * there, not count up to it from nothing.
 */
export class Count {
  readonly node = el('span', 'gb-num')
  #format: (value: number) => string
  #value: number | undefined
  #frame: number | undefined

  constructor(format: (value: number) => string = String) {
    this.#format = format
  }

  set(value: number): void {
    this.#stop()
    const from = this.#value
    this.#value = value
    if (from === undefined || Math.abs(value - from) < SNAP || reducedMotion(this.node)) {
      this.#write(value)
      return
    }
    this.#run(from, value)
  }

  /** Forget what was on screen, so the next value snaps again. */
  reset(): void {
    this.#stop()
    this.#value = undefined
    setText(this.node, '')
  }

  dispose(): void {
    this.#stop()
  }

  #run(from: number, to: number): void {
    const view = this.node.ownerDocument.defaultView
    if (!view?.requestAnimationFrame) {
      this.#write(to)
      return
    }
    const started = view.performance?.now?.() ?? Date.now()
    const step = (now: number): void => {
      const t = Math.min(1, (now - started) / MS.value)
      this.#write(Math.round(from + (to - from) * ease(t)))
      if (t < 1) this.#frame = view.requestAnimationFrame(step)
      else this.#frame = undefined
    }
    this.#frame = view.requestAnimationFrame(step)
  }

  #stop(): void {
    if (this.#frame === undefined) return
    this.node.ownerDocument.defaultView?.cancelAnimationFrame(this.#frame)
    this.#frame = undefined
  }

  #write(value: number): void {
    setText(this.node, this.#format(value))
  }
}

/** The same curve the stylesheet arrives on, in numbers. */
function ease(t: number): number {
  return 1 - (1 - t) ** 3
}
