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

/** A name for the town itself: a head and a tail, or a tail on its own. */
export function cityName(words: Words, rng: Rng): string {
  const tail = rng.pick(words.cityTails)
  if (rng.chance(0.45)) return `${rng.pick(words.cityHeads)} ${tail}`
  return `${rng.pick(words.adjectives)} ${tail}`
}
