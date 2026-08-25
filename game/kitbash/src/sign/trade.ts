import type { BuildingKind } from '@gb/world'

/**
 * How much signage a trade hangs on its wall, and the word it hangs there.
 *
 * A bar shouts and a house does not, which is what makes a street readable from
 * the far end of it: the lit places are the places you can walk into. Every
 * building carries its own name over the door whatever its trade, so nothing is
 * anonymous.
 */
export interface Signage {
  /** Chance of a tall blade down the front. */
  readonly blade: number
  /** Chance of a sign hanging out over the street. */
  readonly hanging: number
  /** How many small lit accents: the door lamps, a strip of marks, a tube up the corner, a board high on the wall. */
  readonly accents: number
  /** How hard the nameplate over the door burns: 1 is neon, 0.25 is a lit house number. */
  readonly nameplate: number
}

const QUIET: Signage = { blade: 0, hanging: 0, accents: 1, nameplate: 0.28 }
const LOUD: Signage = { blade: 0.72, hanging: 0.8, accents: 4, nameplate: 1 }
const TRADE: Signage = { blade: 0.4, hanging: 0.64, accents: 4, nameplate: 1 }
const SOBER: Signage = { blade: 0.34, hanging: 0.26, accents: 3, nameplate: 0.75 }

export const SIGNAGE: Record<BuildingKind, Signage> = {
  house: QUIET,
  chapel: { blade: 0, hanging: 0, accents: 1, nameplate: 0.45 },
  apartment: { blade: 0.2, hanging: 0.2, accents: 3, nameplate: 0.4 },
  bar: LOUD,
  restaurant: LOUD,
  cafe: TRADE,
  clinic: { blade: 0.42, hanging: 0.4, accents: 2, nameplate: 0.9 },
  hotel: { blade: 0.9, hanging: 0.52, accents: 4, nameplate: 1 },
  shop: TRADE,
  market: TRADE,
  office: SOBER,
  station: { blade: 0.32, hanging: 0.36, accents: 3, nameplate: 0.9 },
  workshop: { blade: 0.26, hanging: 0.4, accents: 2, nameplate: 0.7 },
  warehouse: { blade: 0.2, hanging: 0.24, accents: 2, nameplate: 0.55 },
}

/**
 * The word a blade spells: short, so it reads down a narrow panel from the
 * other end of the street. This is the wayfinding: the name over the door tells
 * you which place it is, the blade tells you what it is.
 */
export const TRADE_WORD: Record<BuildingKind, string> = {
  house: 'HOME',
  apartment: 'ROOMS',
  chapel: 'CHAPEL',
  bar: 'BAR',
  cafe: 'CAFE',
  restaurant: 'EAT',
  clinic: 'CLINIC',
  hotel: 'HOTEL',
  shop: 'SHOP',
  market: 'MARKET',
  office: 'OFFICE',
  station: 'STATION',
  workshop: 'REPAIRS',
  warehouse: 'DEPOT',
}
