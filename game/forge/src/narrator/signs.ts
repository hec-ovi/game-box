import { Rng } from '@gb/kit'
import type { BuildingKind } from '@gb/world'
import { flavourOf } from '../theme/flavour.ts'
import { wordsFor } from '../theme/words.ts'
import { NamePool } from './name-pool.ts'
import { placeName } from './places.ts'

/**
 * The name over a door, written from the theme's own vocabulary and the town's
 * own story.
 *
 * Most of a town is frontage, so most of its signs hang over doors nobody can
 * open. Those are written here rather than asked for: a sign is the same kind
 * of fact as a building's style, one string the player reads off the street,
 * and asking a language model for each one costs four calls in five of a build
 * for a door with nothing behind it. The places that do open are written whole
 * by a narrator instead, sign included, and the offline narrator writes theirs
 * off this same pool by the same plot number, so the two never share a head.
 */
export class Signs {
  #rng: Rng
  #pools = new Map<string, NamePool>()

  constructor(seed: string) {
    this.#rng = new Rng(`narrator/${seed}`)
  }

  /** The sign over one door. Same seed, same theme, same story, same index: same sign. */
  over(kind: BuildingKind, theme: string, index: number, premise?: string): string {
    return placeName(kind, index, this.#pool(theme, premise), this.#rng.fork(`place/${index}`))
  }

  /** One pool per town: the same theme and story deal the same heads. */
  #pool(theme: string, premise: string | undefined): NamePool {
    const key = `${theme}\n${premise ?? ''}`
    const held = this.#pools.get(key)
    if (held) return held
    const pool = new NamePool(wordsFor(flavourOf(theme)), theme, premise, this.#rng.fork('signs'))
    this.#pools.set(key, pool)
    return pool
  }
}
