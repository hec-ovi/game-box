import { Rng } from '@gb/kit'
import type { Sampling } from '@gb/sidecar'

/** One past the sidecar's own top seed, because `Rng.int` stops short of its upper bound. */
const SEED_SPAN = 4294967295

/**
 * What every call sends to pin the engine's draw: a seed derived from the
 * build's seed and the call's position, and one temperature.
 *
 * By position, never by a counter: two calls in flight increment a counter in
 * the order they were sent, and a retry lands wherever the failure did, so a
 * counter would give the same city two different seeds on two runs. A label
 * (`quest:3`, `place:12`) and the attempt number are the same on every run.
 */
export class Pins {
  #seed: string
  #temperature: number

  constructor(seed: string, temperature: number) {
    this.#seed = seed
    this.#temperature = temperature
  }

  /** The build's own seed, once the first call names it. */
  reseed(seed: string): void {
    this.#seed = seed
  }

  for(at: string, attempt: number): Sampling {
    return {
      seed: new Rng(`${this.#seed}/${at}/${attempt}`).int(0, SEED_SPAN),
      temperature: this.#temperature,
    }
  }
}
