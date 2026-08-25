import type { Rng } from '@gb/kit'
import type { Charter } from '@gb/world'
import type { Words } from '../theme/words.ts'
import { NamePool, type Head } from './name-pool.ts'

/** The tails a street in a sign's own name takes. */
const ROWS: readonly string[] = ['Row', 'Street', 'Lane', 'Yard']

/** Where a place stands: the town's story as `premiseLines` renders it, and the street its door is on, when either is known. */
export interface Standing {
  readonly premise?: string | undefined
  readonly street?: string | undefined
}

/** A slot in a charter's name template. */
const SLOT = /\{(family|adjective|noun)\}/g

/**
 * What a charter's name templates say a place of this kind is called: the
 * trade words its signs state plainly (`{family} Coffee` gives Coffee), whether
 * a sign may be nothing but a name (`{family}'s`), and the templates that open
 * on an adjective or a family name, filled in as written.
 */
class Naming {
  readonly trades: readonly string[]
  readonly bare: boolean
  readonly adjectives: readonly string[]
  readonly families: readonly string[]

  constructor(charter: Charter) {
    const tails = charter.names.map((name) => name.replace(SLOT, '').replace(/^The\s+/, '').replace(/'s/, '').trim())
    // heirs (`{family} & Sons`) follow a family name and nothing else
    this.trades = tails.filter((tail) => tail && !tail.startsWith('&'))
    this.bare = tails.some((tail) => !tail)
    this.adjectives = charter.names.filter((name) => /^(The )?\{adjective\}/.test(name))
    this.families = charter.names.filter((name) => /^\{family\}/.test(name))
  }

  /** A trade word, or the charter's own label where its signs state none. */
  trade(rng: Rng, fallback: string): string {
    return this.trades.length ? rng.pick(this.trades) : fallback
  }
}

/** A template with its head slot filled by the pool's word and every other slot by the theme's words. */
function fill(template: string, head: string, words: Words, rng: Rng): string {
  let led = false
  return template.replace(SLOT, (_, slot: string) => {
    if (!led) {
      led = true
      return head
    }
    return slot === 'noun' ? rng.pick(words.nouns) : slot === 'adjective' ? rng.pick(words.adjectives) : rng.pick(words.last)
  })
}

/**
 * One name out of one head. A head is the word the sign is remembered by, and
 * which shape it takes decides the rest: a family name on its own or with its
 * heirs, a first name with the trade, a trade plainly stated after a place, a
 * numbered address, or the old "The X Y". The trade is the charter's own word.
 */
function compose(head: Head, charter: Charter, words: Words, rng: Rng, street: string | undefined): string {
  const naming = new Naming(charter)
  const trade = naming.trade(rng, label(charter))
  switch (head.shape) {
    case 'first':
      return naming.bare && rng.chance(0.4) ? `${head.word}'s` : `${head.word}'s ${trade}`
    case 'family':
      return rng.pick([
        `${head.word}'s`,
        `${head.word} & Daughters`,
        `${head.word} & Sons`,
        `${head.word} Brothers`,
        ...(naming.families.length ? naming.families.map((template) => fill(template, head.word, words, rng)) : [`${head.word} ${trade}`, `${head.word} ${trade}`]),
      ])
    case 'adjective':
      return naming.adjectives.length ? fill(rng.pick(naming.adjectives), head.word, words, rng).replace(/^(?!The )/, 'The ') : `The ${head.word} ${rng.pick(words.nouns)}`
    case 'noun':
      return rng.chance(0.5) ? `The ${head.word}` : `The ${head.word} ${trade}`
    case 'place':
      return rng.chance(0.6) ? `${head.word} ${trade}` : `${head.word} ${rng.pick(ROWS)} ${trade}`
    case 'number':
      return `${head.word} ${street ?? `${rng.pick(words.nouns)} ${rng.pick(ROWS)}`}`
  }
}

/** The charter's label as a sign says it: capitalised. */
const label = (charter: Charter): string => charter.label.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())

/**
 * A name for one place: the head is the pool's, taken by the place's index in
 * the town so no word heads two signs in a city, and the seed picks the rest.
 * A numbered address is on the street the door is on, when that is known.
 */
export function placeName(charter: Charter, index: number, pool: NamePool, rng: Rng, street?: string): string {
  return compose(pool.headAt(index), charter, pool.words, rng, street)
}

/** The word a sign is remembered by: the first one that is not an article. */
export function headOf(name: string): string {
  return name.replace(/^The\s+/, '').split(/\s+/)[0]!.replace(/'s$/, '')
}

/** How often a town is named after what it lives on, when its premise says what that is. */
const NAMED_FOR = 0.6

/**
 * A name for the town itself: a head, and then either the thing the town lives
 * on or one of the words a town of this kind is called after. That is what a
 * premise buys the naming: Old Wharf and Upper Campus are two towns before
 * anybody has read a word about either of them.
 */
export function cityName(words: Words, rng: Rng, livesOn?: string): string {
  const tail = rng.pick(words.cityTails)
  const head = rng.chance(0.45) ? rng.pick(words.cityHeads) : rng.pick(words.adjectives)
  if (livesOn && rng.chance(NAMED_FOR)) return `${head} ${livesOn}`
  return `${head} ${tail}`
}
