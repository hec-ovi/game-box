import type { Rng } from '@gb/kit'
import type { Words } from '../theme/words.ts'

/** What a name gets once every pair in the pool has been spent, one per lap. */
const EPITHETS: readonly string[] = ['the Younger', 'the Elder', 'the Quiet', 'the Tall', 'the Late']

/**
 * Every name a town's people can have, dealt out once.
 *
 * The nth person in a town takes the nth pair of first and family name, so
 * nobody in a city shares a name with anybody else and the answer for a person
 * depends on nothing but their number: however many places are being written
 * at once, and whatever order the answers land in, the same person gets the
 * same name. The pairs are every first name against every family name,
 * shuffled once off the seed; a town with more people than pairs starts again
 * with an epithet on the end.
 */
export class Roster {
  readonly #words: Words
  readonly #pairs: readonly number[]

  constructor(words: Words, rng: Rng) {
    this.#words = words
    this.#pairs = rng.shuffle(Array.from({ length: words.first.length * words.last.length }, (_, pair) => pair))
  }

  /** The name the person with this number in the town has. */
  nameAt(index: number): string {
    const lap = Math.floor(index / this.#pairs.length)
    const pair = this.#pairs[index % this.#pairs.length]!
    const name = `${this.#words.first[pair % this.#words.first.length]} ${this.#words.last[Math.floor(pair / this.#words.first.length)]}`
    if (lap === 0) return name
    const epithet = EPITHETS[(lap - 1) % EPITHETS.length]!
    return lap > EPITHETS.length ? `${name} ${epithet} ${lap}` : `${name} ${epithet}`
  }
}
