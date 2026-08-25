import type { Rng } from '@gb/kit'
import type { BuildingKind } from '@gb/world'
import type { Words } from '../theme/words.ts'
import { NamePool, type Head } from './name-pool.ts'

/** What a place of this kind calls its trade on the sign, plainly. */
const TRADES: Record<BuildingKind, readonly string[]> = {
  bar: ['Bar', 'Tap', 'Lounge', 'Saloon'],
  cafe: ['Coffee', 'Cafe', 'Counter', 'Canteen'],
  restaurant: ['Kitchen', 'Table', 'Grill', 'Diner'],
  shop: ['Supply', 'Stores', 'Goods', 'Provisions'],
  market: ['Market', 'Stalls', 'Exchange', 'Market Hall'],
  office: ['& Co.', 'Group', 'Agency', 'Partners'],
  workshop: ['Repairs', 'Works', 'Garage', 'Fitters'],
  warehouse: ['Depot', 'Haulage', 'Storage', 'Freight'],
  clinic: ['Surgery', 'Clinic', 'Dispensary', 'Practice'],
  hotel: ['Rooms', 'Hotel', 'Lodging', 'Inn'],
  station: ['Station', 'Halt', 'Terminal', 'Junction'],
  chapel: ['Chapel', 'Mission', 'Meeting House', 'Hall'],
  house: ['House', 'Cottage', 'Villa', 'Lodge'],
  apartment: ['Apartments', 'Tenements', 'Court', 'Mansions'],
}

/** Places whose sign can be nothing but a name: a bar called Fane's, a cafe called Mara's. */
const BARE: readonly BuildingKind[] = ['bar', 'cafe', 'restaurant', 'shop']

/** The tails a numbered address takes. */
const ROWS: readonly string[] = ['Row', 'Street', 'Lane', 'Yard']

/**
 * One name out of one head. A head is the word the sign is remembered by, and
 * which shape it takes decides the rest: a family name on its own or with its
 * heirs, a first name with the trade, a trade plainly stated after a place, a
 * numbered address, or the old "The X Y". The trade is the kind's own word.
 */
function compose(head: Head, kind: BuildingKind, words: Words, rng: Rng): string {
  const trade = rng.pick(TRADES[kind])
  switch (head.shape) {
    case 'first':
      return BARE.includes(kind) && rng.chance(0.4) ? `${head.word}'s` : `${head.word}'s ${trade}`
    case 'family':
      return rng.pick([
        `${head.word}'s`,
        `${head.word} & Daughters`,
        `${head.word} & Sons`,
        `${head.word} ${trade}`,
        `${head.word} Brothers`,
        `${head.word} ${trade}`,
      ])
    case 'adjective':
      return `The ${head.word} ${rng.pick(words.nouns)}`
    case 'noun':
      return rng.chance(0.5) ? `The ${head.word}` : `The ${head.word} ${trade}`
    case 'place':
      return rng.chance(0.6) ? `${head.word} ${trade}` : `${head.word} ${rng.pick(ROWS)} ${trade}`
    case 'number':
      return `${head.word} ${rng.pick(words.nouns)} ${rng.pick(ROWS)}`
  }
}

/**
 * A name for one place: the head is the pool's, taken by the place's index in
 * the town so no word heads two signs in a city, and the seed picks the rest.
 */
export function placeName(kind: BuildingKind, index: number, pool: NamePool, rng: Rng): string {
  return compose(pool.headAt(index), kind, pool.words, rng)
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
