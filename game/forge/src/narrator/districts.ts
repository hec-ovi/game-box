import { Rng } from '@gb/kit'
import { DistrictSchema } from '@gb/world'
import type { Bearing } from '../layout/districts.ts'
import { flavourOf } from '../theme/flavour.ts'
import { wordsFor, type Words } from '../theme/words.ts'
import { uniqueWords } from './unique.ts'
import { vocabularyOf } from './vocabulary.ts'

/** What a part of town is called after: the tail of a two-word name. */
const TAILS: readonly string[] = ['Bay', 'Gate', 'End', 'Side', 'Quarter', 'Reach', 'Hill', 'Cross', 'Yard', 'Green', 'Bank', 'Fields', 'Rows', 'Basin', 'Mile']

/** Tails that run onto the head as one word: Lowgate, Kilnside. */
const JOINED: readonly string[] = ['gate', 'side', 'end', 'bank', 'hill', 'cross', 'ford', 'wick', 'stead', 'moor']

/** The compass words a name may be built on. A district in the middle of town is named after something else. */
const CARDINAL: Partial<Record<Bearing, string>> = { north: 'North', south: 'South', east: 'East', west: 'West' }

/** The word a district is remembered by, and whether it can stand as a place on its own. */
interface Head {
  readonly word: string
  /** A thing (a kiln, a wharf, a bell) stands alone; a quality (grey, quiet) needs something to qualify. */
  readonly thing: boolean
}

/**
 * What a part of town is called, written from the theme's own vocabulary and
 * the town's own story.
 *
 * A district name is what goes on a road sign and what somebody says out loud:
 * Kiln Bay, the Cut, Lowgate. It is written here rather than asked for so a
 * town always has one, and a narrator that names its districts itself replaces
 * these. The nth district takes the nth head word off a pool dealt once, so no
 * two districts in a town are named after the same thing and the answer for a
 * district depends on nothing but its number.
 *
 * The pool is the theme's own words and the owner's own theme line, and not
 * the story's prose: a premise is sentences, and the words a sentence is built
 * from make a fine sign over a shop (The Months Supply) and a poor name for a
 * quarter of a city. A narrator with the story in front of it writes those.
 */
export class DistrictNames {
  #rng: Rng
  #pools = new Map<string, readonly Head[]>()

  constructor(seed: string) {
    this.#rng = new Rng(`districts/${seed}`)
  }

  /** The name of one district. Same seed, same theme, same number: same name. */
  over(index: number, theme: string, bearing: Bearing): string {
    const words = wordsFor(flavourOf(theme))
    const heads = this.#heads(theme, words)
    return compose(heads[index % heads.length]!, bearing, words, this.#rng.fork(`district/${index}`))
  }

  /** One pool per theme: the same theme deals the same heads. */
  #heads(theme: string, words: Words): readonly Head[] {
    const held = this.#pools.get(theme)
    if (held) return held
    const all: Head[] = [
      // a tail (Harbour, Gulch), a noun (Kiln, Anchor) or one of the owner's own
      // theme words stands as a place on its own; a head (New, Little, Upper)
      // and an adjective qualify one
      ...[...words.cityTails, ...words.nouns, ...vocabularyOf(theme)].map((word) => ({ word, thing: true })),
      ...[...words.cityHeads, ...words.adjectives].map((word) => ({ word, thing: false })),
    ]
    const pool = this.#rng.fork('heads').shuffle(uniqueWords(all))
    this.#pools.set(theme, pool)
    return pool
  }
}

/** One name out of one head: a two-word name, a name run into one word, a bare noun, or a side of town. */
function compose(head: Head, bearing: Bearing, words: Words, rng: Rng): string {
  const compass = CARDINAL[bearing]
  const shapes: string[] = [
    `${head.word} ${rng.pick(TAILS)}`,
    `${head.word}${rng.pick(JOINED)}`,
    head.thing ? `The ${head.word}` : `The ${head.word} ${rng.pick(words.nouns)}`,
    ...(compass && head.thing ? [`${compass} ${head.word}`] : []),
  ]
  return rng.pick(shapes)
}

/** How many spare names one district is offered before it takes what it has. */
const ATTEMPTS = 20

/**
 * What every part of a town is called: what a narrator wrote where it wrote
 * something the file will take, and a name composed from the seed everywhere
 * else. No two districts in one town come out called the same thing, whatever
 * came back, because a repeated name is a map with one place on it twice.
 */
export function districtNames(
  parts: ReadonlyArray<{ readonly bearing: Bearing }>,
  written: readonly string[],
  town: { readonly theme: string; readonly seed: string },
): string[] {
  const composer = new DistrictNames(town.seed)
  const taken = new Set<string>()
  return parts.map((part, index) => {
    let name = fits(written[index]?.trim()) ?? ''
    // the first pass takes the district's own head, so no two of them are
    // named after the same word; a spare takes a head no district has reached
    for (let attempt = 0; attempt <= ATTEMPTS && (!name || taken.has(name.toLowerCase())); attempt++) {
      name = composer.over(index + attempt * parts.length, town.theme, part.bearing)
    }
    taken.add(name.toLowerCase())
    return name
  })
}

/** A name the world document will take, or nothing: what a narrator writes is never trusted to fit. */
function fits(name: string | undefined): string | undefined {
  return name && DistrictSchema.shape.name.safeParse(name).success ? name : undefined
}
