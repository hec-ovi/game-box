import { Rng } from '@gb/kit'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Letters one place may draw family names from. Four of twenty-six means any
 * six places in a row hold pairwise disjoint sets, which covers every wave
 * width the engine offers.
 */
const BLOCK = 4

/**
 * The family names a place is allowed to spend.
 *
 * Two agents writing two places at the same time cannot be shown each other's
 * people, so they cannot agree between themselves not to write the same person
 * twice. A claim moves that agreement out of the answer and into the request:
 * each place is handed its own letters, disjoint from its neighbours', and the
 * tool's own schema refuses a family name that starts with anything else. Two
 * people in one city can only collide if their family names collide, so the
 * partition is the whole of the guarantee and it does not care which reply
 * landed first, or how many were in flight.
 *
 * The alphabet is shuffled once per build, so two seeds do not hand the same
 * quarter of the city the same letters.
 */
export class FamilyClaims {
  #letters: readonly string[]

  constructor(seed: string) {
    this.#letters = new Rng(`${seed}/families`).shuffle([...ALPHABET])
  }

  /** The letters the people in the place at this index are named from. */
  for(index: number): string {
    const start = (Math.abs(index) * BLOCK) % ALPHABET.length
    return Array.from({ length: BLOCK }, (_, k) => this.#letters[(start + k) % ALPHABET.length]!).join('')
  }
}

/** What a family name has to look like to be one of this place's own. */
export function familyPattern(letters: string): RegExp {
  return new RegExp(`^[${letters}][A-Za-z'-]{1,23}$`)
}
