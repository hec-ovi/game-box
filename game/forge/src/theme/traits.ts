import type { Charter } from '@gb/world'
import type { Flavour } from './flavour.ts'

/**
 * What a kind of place is, read off its charter's axes rather than its word.
 * A theme leans on these, so a jail or a cabaret the history invents is
 * weighed the way its traits say and never by anything it is called.
 */
const TRAITS = {
  /** Somewhere people live, a few storeys or fewer. */
  homes: (c: Charter) => c.residential && c.size.storeys[0] < 3,
  /** Somewhere people live stacked up. */
  flats: (c: Charter) => c.residential && c.size.storeys[0] >= 3,
  /** Beds for the night that nobody lives in. */
  lodging: (c: Charter) => !c.residential && c.finish === 'domestic',
  /** A counter that pours. */
  drinks: (c: Charter) => c.service !== 'none' && c.holding.includes('drink'),
  /** Somewhere food is served. */
  eats: (c: Charter) => c.holding.includes('food'),
  /** Food and drink together: a sit-down meal. */
  dines: (c: Charter) => c.holding.includes('food') && c.holding.includes('drink'),
  /** A counter with a floor to browse. */
  shops: (c: Charter) => c.service === 'counter' && c.work.includes('floor'),
  /** Stalls. */
  stalls: (c: Charter) => c.service === 'stalls',
  /** Somewhere things are made or mended at a bench. */
  makes: (c: Charter) => c.work.includes('bench'),
  /** Goods kept behind no counter. */
  stores: (c: Charter) => c.service === 'none' && c.holding.includes('goods'),
  /** Desk work in a corporate finish. */
  desks: (c: Charter) => c.finish === 'corporate' && c.work.includes('desk'),
  /** Medicine on the shelves. */
  cares: (c: Charter) => c.holding.includes('medicine'),
  /** A civic hall with no counter: somewhere people gather. */
  gathers: (c: Charter) => c.finish === 'civic' && c.service === 'none',
  /** A civic place somebody keeps watch over: where the town leaves from. */
  transit: (c: Charter) => c.finish === 'civic' && c.work.includes('watch'),
} satisfies Record<string, (charter: Charter) => boolean>

type Trait = keyof typeof TRAITS

/** What each flavour has more and less of, as a multiple per trait. A place with two of them gets both. */
const TILT: Record<Flavour, Partial<Record<Trait, number>>> = {
  frontier: { drinks: 2, makes: 1.5, gathers: 2, transit: 2, lodging: 2, stores: 1.5, flats: 0.3, desks: 0.4, eats: 0.5 },
  coastal: { stalls: 3, stores: 3, eats: 1.5, drinks: 1.5, lodging: 2, desks: 0.5, makes: 1.5 },
  industrial: { stores: 4, makes: 2.5, transit: 3, flats: 1.5, cares: 2, gathers: 0.5, lodging: 0.5, dines: 0.5 },
  neon: { flats: 3, desks: 2.5, cares: 2, drinks: 2, shops: 1.5, lodging: 2, transit: 2, homes: 0.2, gathers: 0.3 },
  alpine: { lodging: 3, gathers: 2, eats: 1.5, makes: 1.5, flats: 0.5, desks: 0.3, stores: 0.5 },
  agrarian: { stalls: 3, gathers: 2, makes: 1.5, stores: 2, homes: 1.2, flats: 0.2, desks: 0.3, lodging: 0.5 },
  plain: {},
}

/** How much a kind of town leans on this kind of place: the product of every trait the theme has a view on. */
export function tiltOf(flavour: Flavour, charter: Charter): number {
  let tilt = 1
  for (const [trait, factor] of Object.entries(TILT[flavour]) as Array<[Trait, number]>) {
    if (TRAITS[trait](charter)) tilt *= factor
  }
  return tilt
}
