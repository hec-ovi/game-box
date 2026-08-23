import type { Rng } from '@gb/kit'
import type { BuildingKind } from '@gb/world'
import type { Words } from '../theme/words.ts'

/** The parts a sign is written from. */
interface Sign {
  readonly adjective: string
  readonly noun: string
  readonly family: string
}

type Pattern = (sign: Sign) => string

/** Two or three ways each kind of place names itself, so no town reads off one template. */
const PATTERNS: Record<BuildingKind, readonly Pattern[]> = {
  bar: [(s) => `The ${s.adjective} ${s.noun}`, (s) => `${s.family}'s`, (s) => `The ${s.noun} & ${s.adjective}`],
  cafe: [(s) => `${s.adjective} ${s.noun} Coffee`, (s) => `${s.family}'s Counter`, (s) => `The ${s.noun} Cup`],
  restaurant: [(s) => `${s.noun} House`, (s) => `${s.family}'s Table`, (s) => `The ${s.adjective} Kitchen`],
  shop: [(s) => `${s.family} Supply`, (s) => `The ${s.adjective} ${s.noun}`, (s) => `${s.family} & Daughters`],
  market: [(s) => `${s.adjective} Market`, (s) => `${s.noun} Market Hall`, (s) => `The ${s.adjective} Stalls`],
  office: [(s) => `${s.family} & Co.`, (s) => `${s.family} Brothers`, (s) => `${s.adjective} ${s.noun} Group`],
  workshop: [(s) => `${s.family} Repairs`, (s) => `The ${s.adjective} ${s.noun} Works`, (s) => `${s.family} & Son`],
  warehouse: [(s) => `${s.adjective} Depot`, (s) => `${s.noun} Store No. 2`, (s) => `${s.family} Haulage`],
  clinic: [(s) => `${s.family} Surgery`, (s) => `The ${s.adjective} Ward`, (s) => `${s.noun} Street Clinic`],
  hotel: [(s) => `The ${s.adjective} ${s.noun} Rooms`, (s) => `${s.family} House`, (s) => `The ${s.noun} Inn`],
  station: [(s) => `${s.adjective} Station`, (s) => `${s.noun} Halt`, (s) => `${s.family} Street Station`],
  chapel: [(s) => `${s.adjective} Chapel`, (s) => `The Chapel of the ${s.noun}`, (s) => `${s.family} Chapel`],
  house: [(s) => `${s.family} House`, (s) => `The ${s.adjective} ${s.noun}`, (s) => `${s.family} Cottage`],
  apartment: [(s) => `${s.adjective} Apartments`, (s) => `${s.noun} Buildings`, (s) => `${s.family} Tenements`],
}

/** A name for one place: its kind picks the pattern, the seed picks the words. */
export function placeName(kind: BuildingKind, words: Words, rng: Rng): string {
  const sign: Sign = { adjective: rng.pick(words.adjectives), noun: rng.pick(words.nouns), family: rng.pick(words.last) }
  return rng.pick(PATTERNS[kind])(sign)
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
