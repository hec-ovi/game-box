/**
 * How a call waits when the model is busy.
 *
 * A rate limit is the normal path on a free tier, not a dead endpoint, so a
 * busy answer is waited out and asked again. The wait is the sidecar's own
 * `Retry-After` when it names one, and a doubling schedule when it does not;
 * either way a random share on top spreads out callers that were refused
 * together, and the box never asks twice in a row without waiting.
 *
 * Two things end the waiting: the tries run out, or the sidecar asks for
 * longer than `capMs`. Then the caller hears `busy` with the seconds it is
 * worth waiting, and decides for itself.
 */
export interface Backoff {
  /** How many times one call is sent before `busy` is reported, the first try included. */
  readonly attempts: number
  /** The first wait when the sidecar names no `Retry-After`. Each later one doubles it. */
  readonly baseMs: number
  /** The longest wait this box sits through. A `Retry-After` past it is reported, never waited for. */
  readonly capMs: number
  /** Added on top of every wait, as a random share of it, so retries from many callers spread out. */
  readonly jitter: number
}

export const DEFAULT_BACKOFF: Backoff = {
  attempts: 4,
  baseMs: 2000,
  capMs: 60_000,
  jitter: 0.25,
}

/** What a caller hears before each wait, so the screen can say the model is busy. */
export interface BusyNotice {
  /** The try that was just refused, counted from 1. */
  readonly attempt: number
  /** Seconds the sidecar asked for, or the box's own step when it named none. */
  readonly retryAfter: number
  /** How long this box is about to wait. */
  readonly waitMs: number
}

export class BusySchedule {
  readonly #backoff: Backoff

  constructor(backoff: Backoff) {
    this.#backoff = backoff
  }

  /**
   * Seconds before try `next` is worth making: the sidecar's own number, or
   * this box's step when it named none. A hint of zero counts as none, so no
   * answer can ever ask for a retry with no wait at all.
   */
  retryAfter(next: number, hint: number | undefined): number {
    return hint || (this.#backoff.baseMs * 2 ** (next - 2)) / 1000
  }

  /**
   * How long to wait before try `next`, or nothing when the call should stop
   * asking: the tries are used up, or the wait is past the cap.
   */
  waitBefore(next: number, retryAfter: number): number | undefined {
    const { attempts, capMs, jitter } = this.#backoff
    const ms = retryAfter * 1000
    if (next > attempts || ms > capMs) return undefined
    return Math.min(capMs, Math.round(ms * (1 + Math.random() * jitter)))
  }
}
