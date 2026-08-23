import { Rng } from '@gb/kit'
import type { BuildingKind } from '@gb/world'
import { flavourOf } from '../theme/flavour.ts'
import { wordsFor } from '../theme/words.ts'
import { placeName } from './places.ts'

/**
 * The name over a door, written from the theme's own vocabulary.
 *
 * Most of a town is frontage, so most of its signs hang over doors nobody can
 * open. Those are written here rather than asked for: a sign is the same kind
 * of fact as a building's style, one string the player reads off the street,
 * and asking a language model for each one costs four calls in five of a build
 * for a door with nothing behind it. The places that do open are written whole
 * by a narrator instead, sign included.
 */
export class Signs {
  #rng: Rng

  constructor(seed: string) {
    this.#rng = new Rng(`narrator/${seed}`)
  }

  /** The sign over one door. Same seed, same index, same sign. */
  over(kind: BuildingKind, theme: string, index: number): string {
    return placeName(kind, wordsFor(flavourOf(theme)), this.#rng.fork(`place/${kind}/${index}`))
  }
}
