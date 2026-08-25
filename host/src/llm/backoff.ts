/**
 * How long to tell a caller to wait when the upstream is busy and did not say.
 * Doubles per consecutive refusal, so a cap that lasts stops being hammered,
 * and starts over as soon as the upstream answers anything else.
 */
export class Backoff {
  static readonly FIRST_SECONDS = 1
  static readonly MAX_SECONDS = 60

  #refusals = 0

  /** Seconds to wait after one more refusal. */
  next(): number {
    const seconds = Math.min(Backoff.FIRST_SECONDS * 2 ** this.#refusals, Backoff.MAX_SECONDS)
    this.#refusals += 1
    return seconds
  }

  reset(): void {
    this.#refusals = 0
  }
}
