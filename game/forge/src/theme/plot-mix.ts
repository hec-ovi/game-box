import type { Rng } from '@gb/kit'
import { BUILDING_KINDS, type BuildingKind } from '@gb/world'
import type { Flavour } from './flavour.ts'

export type KindWeights = ReadonlyArray<readonly [BuildingKind, number]>

/** A mixed town, before the theme pulls it one way or another. */
const BASE: Record<BuildingKind, number> = {
  house: 10,
  apartment: 3,
  shop: 3,
  office: 2,
  bar: 2,
  cafe: 2,
  workshop: 2,
  warehouse: 1,
  restaurant: 1,
  clinic: 1,
  hotel: 1,
  market: 1,
  chapel: 1,
  station: 1,
}

/** What each flavour has more and less of, as a multiple of the base. */
const TILT: Record<Flavour, Partial<Record<BuildingKind, number>>> = {
  frontier: { bar: 2, workshop: 1.5, chapel: 2, station: 2, hotel: 2, warehouse: 1.5, apartment: 0.3, office: 0.4, cafe: 0.5 },
  coastal: { market: 3, warehouse: 3, cafe: 1.5, restaurant: 2, bar: 1.5, hotel: 2, office: 0.5, workshop: 1.5 },
  industrial: { warehouse: 4, workshop: 2.5, station: 3, apartment: 1.5, clinic: 2, chapel: 0.5, hotel: 0.5, restaurant: 0.5 },
  neon: { apartment: 3, office: 2.5, clinic: 2, bar: 2, shop: 1.5, hotel: 2, station: 2, house: 0.2, chapel: 0.3 },
  alpine: { hotel: 3, chapel: 2, cafe: 1.5, restaurant: 1.5, workshop: 1.5, apartment: 0.5, office: 0.3, warehouse: 0.5 },
  agrarian: { market: 3, chapel: 2, workshop: 1.5, warehouse: 2, house: 1.2, apartment: 0.2, office: 0.3, hotel: 0.5 },
  plain: {},
}

/** Somewhere to live. Never dropped, and never rolled below what the theme asks for. */
const HOUSING: readonly BuildingKind[] = ['house', 'apartment']

/** How far one kind swings either side of what the theme asks for. */
const SWING: readonly number[] = [0.6, 0.8, 1, 1, 1, 1.25, 1.5]

/** The one place every town has, whatever the theme: somewhere everybody passes through. */
const KEYSTONE: BuildingKind = 'bar'

/** Kinds a staple set is drawn from: places with a counter, a door and a reason to walk in. */
const STAPLE_SETS: Record<Flavour, readonly BuildingKind[]> = {
  frontier: ['bar', 'shop', 'workshop', 'chapel', 'station', 'hotel'],
  coastal: ['market', 'bar', 'cafe', 'warehouse', 'shop', 'restaurant'],
  industrial: ['workshop', 'warehouse', 'bar', 'clinic', 'station', 'shop'],
  neon: ['bar', 'clinic', 'shop', 'office', 'hotel', 'cafe'],
  alpine: ['hotel', 'bar', 'chapel', 'shop', 'cafe', 'clinic'],
  agrarian: ['market', 'chapel', 'bar', 'shop', 'workshop', 'clinic'],
  plain: ['bar', 'shop', 'cafe', 'market', 'clinic', 'chapel'],
}

/** How many places a town is known for on top of its bar. */
const FEWEST_STAPLES = 1
const MOST_STAPLES = 3

/**
 * What a town of this flavour is made of, jittered by the seed: the theme sets
 * the shape of the mix and the seed moves every kind around inside it, up to
 * dropping two kinds the town turns out not to have at all.
 */
export function kindWeights(flavour: Flavour, rng: Rng): KindWeights {
  const tilt = TILT[flavour]
  const missing = new Set(
    rng
      .shuffle(BUILDING_KINDS.filter((kind) => !HOUSING.includes(kind)))
      .slice(0, rng.int(0, 3)),
  )
  const weights = BUILDING_KINDS.map((kind) => {
    // a town is mostly where people live: the seed decides what else is on the street
    const swing = rng.pick(SWING)
    const wanted = BASE[kind] * (tilt[kind] ?? 1) * (HOUSING.includes(kind) ? Math.max(1, swing) : swing)
    return [kind, missing.has(kind) ? 0 : Math.max(1, Math.round(wanted))] as const
  })
  return weights.filter(([, weight]) => weight > 0)
}

/**
 * The places this town is known for, whatever the mix rolls: its bar, and one
 * to three more out of what a town of this kind has. They go on seeded sites,
 * so two towns are not the same two places on the same two corners.
 */
export function stapleKinds(flavour: Flavour, rng: Rng): readonly BuildingKind[] {
  const rest = rng.shuffle(STAPLE_SETS[flavour].filter((kind) => kind !== KEYSTONE))
  return [KEYSTONE, ...rest.slice(0, rng.int(FEWEST_STAPLES, MOST_STAPLES + 1))]
}

/** The set a flavour's staples are drawn from, for anything checking a town holds its own. */
export function stapleSet(flavour: Flavour): readonly BuildingKind[] {
  return STAPLE_SETS[flavour]
}
