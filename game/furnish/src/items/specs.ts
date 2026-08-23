/**
 * Every kind of thing a player can pick up: how big it really is, and the
 * matter its casts are made of.
 *
 * The vocabulary is `@gb/world`'s `ITEM_ARCHETYPES` and this table covers all of
 * it. Sizes are the real object, in metres, because these are held and carried
 * and seen at arm's length: an envelope is 220 by 110 mm and a crate is not,
 * and getting the relative sizes right is most of what makes one readable
 * against another.
 *
 * The box is a promise, the same way a prop's cells are: every triangle of
 * every cast lands inside `width` by `depth` by `height`, so whatever holds an
 * item (a hand, a shelf, a counter) can size the slot without asking which cast
 * it drew.
 */
import { type ItemArchetype } from '@gb/world'
import type { Matter } from './matter.ts'

export interface ItemSpec {
  /** Metres across the front. */
  readonly width: number
  /** Metres front to back. */
  readonly depth: number
  /** Metres tall. */
  readonly height: number
  /** The body of the thing, one entry per cast, in cast order. */
  readonly body: readonly Matter[]
  /** Its second material: a spine, a cap, a frame, a fitting. */
  readonly trim: Matter
  /** The one small bright thing on it: a stamp, a label, a band, a seal. */
  readonly mark: Matter
}

export const ITEM_SPECS: Record<ItemArchetype, ItemSpec> = {
  bottle: { width: 0.078, depth: 0.078, height: 0.3, body: ['bottleGlass', 'brownGlass', 'clearGlass'], trim: 'chrome', mark: 'bond' },
  glass: { width: 0.072, depth: 0.072, height: 0.135, body: ['clearGlass', 'enamel', 'ceramic'], trim: 'clearGlass', mark: 'drink' },
  crate: { width: 0.44, depth: 0.34, height: 0.3, body: ['pallet', 'timber', 'gunmetal'], trim: 'steel', mark: 'amber' },
  box: { width: 0.32, depth: 0.24, height: 0.22, body: ['kraft', 'card', 'white'], trim: 'manila', mark: 'red' },
  parcel: { width: 0.26, depth: 0.19, height: 0.1, body: ['manila', 'paper', 'kraft'], trim: 'ink', mark: 'red' },
  book: { width: 0.15, depth: 0.22, height: 0.04, body: ['oxblood', 'navy', 'moss'], trim: 'brass', mark: 'paper' },
  ledger: { width: 0.22, depth: 0.31, height: 0.055, body: ['ink', 'hide', 'slate'], trim: 'brass', mark: 'bond' },
  envelope: { width: 0.22, depth: 0.11, height: 0.008, body: ['bond', 'manila', 'paper'], trim: 'ink', mark: 'red' },
  key: { width: 0.058, depth: 0.024, height: 0.006, body: ['brass', 'steel', 'gunmetal'], trim: 'ink', mark: 'ink' },
  keycard: { width: 0.086, depth: 0.054, height: 0.003, body: ['ink', 'teal', 'white'], trim: 'gunmetal', mark: 'brass' },
  bag: { width: 0.46, depth: 0.24, height: 0.31, body: ['duffel', 'canvas', 'leather'], trim: 'ink', mark: 'amber' },
  briefcase: { width: 0.44, depth: 0.32, height: 0.14, body: ['leather', 'ink', 'gunmetal'], trim: 'chrome', mark: 'brass' },
  toolbox: { width: 0.42, depth: 0.2, height: 0.21, body: ['red', 'steel', 'teal'], trim: 'gunmetal', mark: 'chrome' },
  wrench: { width: 0.28, depth: 0.062, height: 0.014, body: ['chrome', 'steel', 'gunmetal'], trim: 'ink', mark: 'ink' },
  painting: { width: 0.46, depth: 0.055, height: 0.38, body: ['navy', 'moss', 'oxblood'], trim: 'brass', mark: 'amber' },
  statue: { width: 0.15, depth: 0.15, height: 0.4, body: ['stone', 'brass', 'jade'], trim: 'slate', mark: 'brass' },
  phone: { width: 0.075, depth: 0.155, height: 0.01, body: ['ink', 'gunmetal', 'white'], trim: 'chrome', mark: 'screen' },
  radio: { width: 0.28, depth: 0.13, height: 0.34, body: ['slate', 'kraft', 'teal'], trim: 'gunmetal', mark: 'readout' },
  plate: { width: 0.25, depth: 0.25, height: 0.024, body: ['ceramic', 'enamel', 'white'], trim: 'ceramic', mark: 'navy' },
  cup: { width: 0.112, depth: 0.086, height: 0.096, body: ['ceramic', 'enamel', 'white'], trim: 'ceramic', mark: 'teal' },
  cash: { width: 0.156, depth: 0.066, height: 0.034, body: ['bond', 'paper', 'moss'], trim: 'ink', mark: 'red' },
  gem: { width: 0.046, depth: 0.046, height: 0.058, body: ['fire', 'cyan', 'jade'], trim: 'chrome', mark: 'chrome' },
  flower: { width: 0.11, depth: 0.11, height: 0.34, body: ['petal', 'fire', 'bond'], trim: 'stem', mark: 'brass' },
  medkit: { width: 0.28, depth: 0.18, height: 0.13, body: ['white', 'canvas', 'steel'], trim: 'gunmetal', mark: 'red' },
  fuelcan: { width: 0.3, depth: 0.17, height: 0.38, body: ['moss', 'red', 'gunmetal'], trim: 'gunmetal', mark: 'amber' },
}
