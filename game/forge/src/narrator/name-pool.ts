import type { Rng } from '@gb/kit'
import type { Words } from '../theme/words.ts'
import { vocabularyOf } from './vocabulary.ts'

/** The shapes a sign takes, named by what its head word is. */
export type Shape = 'first' | 'family' | 'adjective' | 'noun' | 'place' | 'number'

/** The word a sign is remembered by, and the shape of sign it heads. */
export interface Head {
  readonly word: string
  readonly shape: Shape
}

/** How many numbered addresses go into a pool alongside the words. */
const NUMBERS = 40

/**
 * Every head word a town can put on a sign, dealt out once.
 *
 * A town's plots are numbered in the order they go up, and the nth plot takes
 * the nth head, so no word heads two signs in a city and the answer for a plot
 * depends on nothing but its number: the box writing the shut signs and a
 * narrator naming the open places can both ask for plot 12 and neither can
 * collide with the other. The pool is the theme's whole vocabulary, first
 * names, family names, adjectives, nouns and the words for places, plus the
 * words the town's own story is told in, shuffled once off the seed. A town
 * bigger than the pool numbers the rest, and a number heads no other sign.
 */
export class NamePool {
  readonly words: Words
  readonly #heads: readonly Head[]

  constructor(words: Words, theme: string, premise: string | undefined, rng: Rng) {
    this.words = words
    const all: Head[] = [
      ...words.first.map((word) => ({ word, shape: 'first' as const })),
      ...words.last.map((word) => ({ word, shape: 'family' as const })),
      ...words.adjectives.map((word) => ({ word, shape: 'adjective' as const })),
      ...words.nouns.map((word) => ({ word, shape: 'noun' as const })),
      ...words.cityHeads.map((word) => ({ word, shape: 'place' as const })),
      ...words.cityTails.map((word) => ({ word, shape: 'place' as const })),
      ...vocabularyOf(`${theme}\n${premise ?? ''}`).map((word) => ({ word, shape: 'place' as const })),
      ...Array.from({ length: NUMBERS }, (_, n) => ({ word: String(n + 1), shape: 'number' as const })),
    ]
    this.#heads = rng.shuffle(unique(all))
  }

  /** How many signs the pool heads before it starts numbering them. */
  get size(): number {
    return this.#heads.length
  }

  /** The head word the plot with this number takes. */
  headAt(index: number): Head {
    return this.#heads[index] ?? { word: String(index + 1), shape: 'number' }
  }
}

/** One head per word, whichever list said it first, so "Iron" is spent once. */
function unique(heads: readonly Head[]): Head[] {
  const seen = new Set<string>()
  return heads.filter((head) => {
    const key = head.word.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
