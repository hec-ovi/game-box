import type { SidecarError, TimeoutPhase } from './errors.ts'

/**
 * One `AbortSignal` for one call, and the reason it fired.
 *
 * It joins two things that can stop a call: the signal the caller passed in,
 * and a clock that the call restarts as progress arrives. Whichever fires
 * first wins and is remembered, so `unreachable` (the network gave up),
 * `timeout` (nothing came back in time) and `aborted` (the caller pulled the
 * plug) stay three different answers instead of one rejected fetch.
 *
 * `release()` clears the timer and drops the listener on the caller's signal.
 * Every path that creates a `Deadline` releases it.
 */
export class Deadline {
  readonly #controller = new AbortController()
  readonly #caller: AbortSignal | undefined
  readonly #onCallerAbort: () => void
  #timer: ReturnType<typeof setTimeout> | undefined
  #armedAt = 0
  #phase: TimeoutPhase
  #ms: number
  #reason: 'timeout' | 'aborted' | undefined
  #released = false

  constructor(options: { signal: AbortSignal | undefined; phase: TimeoutPhase; ms: number }) {
    this.#caller = options.signal
    this.#phase = options.phase
    this.#ms = options.ms
    this.#onCallerAbort = () => this.#fire('aborted')

    if (this.#caller?.aborted) {
      this.#fire('aborted')
      return
    }
    this.#caller?.addEventListener('abort', this.#onCallerAbort, { once: true })
    this.#arm()
  }

  /** Pass this to `fetch`. It is already aborted if the caller's signal was. */
  get signal(): AbortSignal {
    return this.#controller.signal
  }

  /** Progress arrived: start the next clock. A deadline that already fired stays fired. */
  restart(phase: TimeoutPhase, ms: number): void {
    if (this.#reason || this.#released) return
    this.#phase = phase
    this.#ms = ms
    this.#arm()
  }

  /** How much of the running clock is left. Nothing once it has fired. */
  remaining(): number {
    if (this.#reason) return 0
    return Math.max(0, this.#ms - (Date.now() - this.#armedAt))
  }

  /** Why this call stopped, or nothing if it was the network or the model itself. */
  failure(): SidecarError | undefined {
    if (this.#reason === 'aborted') return { code: 'aborted', message: 'the caller aborted the call' }
    if (this.#reason === 'timeout') {
      return {
        code: 'timeout',
        phase: this.#phase,
        ms: this.#ms,
        message: `${TIMEOUT_TEXT[this.#phase]} within ${this.#ms} ms`,
      }
    }
    return undefined
  }

  /** Clear the timer and stop listening. Safe to call twice. */
  release(): void {
    if (this.#released) return
    this.#released = true
    this.#disarm()
    this.#caller?.removeEventListener('abort', this.#onCallerAbort)
  }

  #arm(): void {
    this.#disarm()
    this.#armedAt = Date.now()
    const timer = setTimeout(() => this.#fire('timeout'), this.#ms)
    // A pending timer must never be the reason a process stays alive.
    ;(timer as { unref?: () => void }).unref?.()
    this.#timer = timer
  }

  #disarm(): void {
    if (this.#timer === undefined) return
    clearTimeout(this.#timer)
    this.#timer = undefined
  }

  #fire(reason: 'timeout' | 'aborted'): void {
    if (this.#reason) return
    this.#reason = reason
    this.#disarm()
    this.#controller.abort()
  }
}

const TIMEOUT_TEXT: Record<TimeoutPhase, string> = {
  response: 'the sidecar did not answer',
  'first-token': 'the reply did not start',
  token: 'the reply stopped',
}
