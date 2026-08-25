import type { Rng } from '@gb/kit'
import type { ItemArchetype } from '@gb/world'

/**
 * What a thing of each kind goes for, in whole credits, before the seed moves
 * it. A cup is pocket money and a gem is a month's wages, so a reward paid in
 * credits buys something in a cafe and nothing in a jeweller's.
 */
const GOING_RATE: Record<ItemArchetype, number> = {
  bottle: 8,
  glass: 3,
  crate: 40,
  box: 12,
  parcel: 15,
  book: 10,
  ledger: 25,
  envelope: 5,
  key: 20,
  keycard: 60,
  deed: 800,
  bag: 18,
  briefcase: 45,
  toolbox: 55,
  wrench: 14,
  painting: 120,
  statue: 200,
  phone: 90,
  radio: 35,
  plate: 4,
  cup: 3,
  cash: 50,
  gem: 300,
  flower: 2,
  medkit: 30,
  fuelcan: 22,
}

/** How far one thing's price swings either side of the going rate. */
const HAGGLE = 0.3

/** The price a counter sells this thing for: the going rate, moved by the seed. */
export function priceOf(archetype: ItemArchetype, rng: Rng): number {
  return Math.max(1, Math.round(GOING_RATE[archetype] * rng.range(1 - HAGGLE, 1 + HAGGLE)))
}
