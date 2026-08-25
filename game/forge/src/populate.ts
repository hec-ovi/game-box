import { HOLDING_ARCHETYPES, type Anchor, type AnchorKind, type BodyKind, type Charter, type ItemArchetype, type NpcRole } from '@gb/world'
import type { Rng } from '@gb/kit'

/**
 * Who stands at an anchor of this kind, in this kind of place. The anchor
 * decides first; where it does not, the charter's service and work do, so a
 * counter that pours has a bartender and a bench a mechanic whatever the place
 * is called. Every answer is one of `@gb/world`'s closed roles.
 */
export function roleFor(anchor: AnchorKind, charter: Charter): NpcRole | undefined {
  switch (anchor) {
    case 'serve':
      if (charter.service === 'stalls') return 'vendor'
      if (charter.service === 'desk') return 'receptionist'
      if (charter.work.includes('bench')) return 'mechanic'
      if (charter.holding.includes('drink') || charter.holding.includes('food')) return 'bartender'
      return 'clerk'
    case 'sit':
      return charter.residential ? 'resident' : 'patron'
    case 'sit-drink':
    case 'browse':
    case 'dance':
      return 'patron'
    case 'work-desk':
      return charter.residential ? 'resident' : charter.work.includes('bench') ? 'mechanic' : 'worker'
    case 'work-bench':
      return charter.work.includes('bench') ? 'mechanic' : 'worker'
    case 'cook':
      return 'cook'
    case 'sleep':
      return charter.holding.includes('medicine') ? 'patron' : 'resident'
    case 'guard':
      return 'guard'
    case 'stand':
      return charter.work.includes('watch') ? 'guard' : 'worker'
    case 'lean':
      return 'wanderer'
  }
}

/** Which body somebody has: one of the two the pack ships, drawn from the interior's own stream. */
export function bodyFor(rng: Rng): BodyKind {
  return rng.pick(['male', 'female'] as const)
}

/**
 * How likely an anchor of this kind has somebody on it, in this kind of place.
 * Staff posts are always filled, and a place that keeps watch has its guard on
 * the door the way a counter has somebody behind it.
 */
export function occupancy(anchor: AnchorKind, charter: Charter): number {
  switch (anchor) {
    case 'serve':
      return 1
    case 'guard':
      return charter.work.includes('watch') ? 1 : 0.25
    case 'work-desk':
    case 'work-bench':
      return 0.7
    case 'cook':
      return 0.6
    case 'sleep':
      return 0.4
    case 'sit-drink':
    // somebody propped at the wall or dancing is a customer like somebody at a table
    case 'lean':
    case 'dance':
      return 0.5
    case 'sit':
    case 'browse':
      return 0.35
    default:
      return 0.25
  }
}

/** Where a loose item sits: on a surface somebody uses, before bare floor. */
export function surfacesOf(anchors: readonly Anchor[]): readonly Anchor[] {
  const surfaces = anchors.filter((anchor) => anchor.propId !== undefined)
  return surfaces.length ? surfaces : anchors
}

/** Everything this kind of place could have lying about: every archetype of every class it holds. A deed is never stock; one is written only when a place is put up for sale. */
export function stockOf(charter: Charter): readonly ItemArchetype[] {
  return charter.holding.flatMap((holding) => HOLDING_ARCHETYPES[holding]).filter((archetype) => archetype !== 'deed')
}

/**
 * Who keeps a place: whoever is at its counter, else whoever is on its door,
 * else the first person with a job in it. One keeper per place, and their post
 * is filled whatever the dice say where it matters: a lock always has its key
 * in somebody's pocket, and a home always has somebody living in it.
 */
export function keeperOf(anchors: readonly Anchor[], charter: Charter): Anchor | undefined {
  const staffed = anchors.filter((anchor) => roleFor(anchor.kind, charter) !== undefined)
  return staffed.find((anchor) => anchor.kind === 'serve') ?? staffed.find((anchor) => anchor.kind === 'guard') ?? staffed[0]
}

/** The most a place has lying about, however many surfaces it has: past this a room reads as a store room. */
const MOST_STOCK = 6

/**
 * What is lying about in a place: one thing for every surface it has to put one
 * on. A city opens a handful of places, so each of them is stocked rather than
 * sampled, and where it has more surfaces than its charter has kinds of stock
 * the pool is dealt again.
 */
export function itemsFor(charter: Charter, rng: Rng, surfaces: number): ItemArchetype[] {
  const pool = stockOf(charter)
  if (!pool.length) return []
  const count = Math.max(1, Math.min(MOST_STOCK, surfaces))
  const dealt: ItemArchetype[] = []
  while (dealt.length < count) dealt.push(...rng.shuffle(pool))
  return dealt.slice(0, count)
}

/** How much of the player an item takes to carry. */
export function bulkOf(archetype: ItemArchetype): 'pocket' | 'bag' | 'two-handed' {
  const twoHanded: readonly ItemArchetype[] = ['crate', 'statue', 'painting', 'fuelcan']
  const bagged: readonly ItemArchetype[] = ['box', 'parcel', 'bag', 'briefcase', 'toolbox', 'medkit', 'radio']
  if (twoHanded.includes(archetype)) return 'two-handed'
  if (bagged.includes(archetype)) return 'bag'
  return 'pocket'
}
