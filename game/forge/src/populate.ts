import { Rng } from '@gb/kit'
import type { Anchor, AnchorKind, BodyKind, BuildingKind, ItemArchetype, NpcRole } from '@gb/world'

/** Who stands at an anchor of this kind, in this kind of building. */
export function roleFor(anchor: AnchorKind, building: BuildingKind): NpcRole | undefined {
  switch (anchor) {
    case 'serve':
      if (building === 'bar' || building === 'cafe' || building === 'restaurant') return 'bartender'
      if (building === 'shop') return 'clerk'
      if (building === 'market') return 'vendor'
      if (building === 'workshop') return 'mechanic'
      return 'receptionist'
    case 'sit-drink':
      return 'patron'
    case 'sit':
      return building === 'house' || building === 'apartment' ? 'resident' : 'patron'
    case 'browse':
      return 'patron'
    case 'work-desk':
    case 'work-bench':
      return building === 'workshop' ? 'mechanic' : 'worker'
    case 'cook':
      return 'cook'
    case 'sleep':
      return building === 'clinic' ? 'patron' : 'resident'
    case 'guard':
      return 'guard'
    case 'stand':
      return building === 'warehouse' ? 'guard' : 'worker'
    case 'lean':
      return 'wanderer'
    case 'dance':
      return 'patron'
  }
}

/** Roles whose work can put a hero body on the floor: the ones on their feet, watching or lifting. */
const HERO_ROLES: readonly NpcRole[] = ['guard', 'worker', 'mechanic']

/** How many of those get one. */
const HERO_SHARE = 0.25

/**
 * Which body somebody has. Everybody is one of the two plain bodies, drawn from
 * the interior's own stream; a minority of the guards and the people who work on
 * their feet get the hero build instead, decided off their own index in the town
 * so the same person is the same build every time the city is opened.
 */
export function bodyFor(role: NpcRole, index: number, rng: Rng): BodyKind {
  const plain = rng.pick(['male', 'female'] as const)
  const hero = HERO_ROLES.includes(role) && new Rng(`hero/${index}`).chance(HERO_SHARE)
  return hero ? `hero-${plain}` : plain
}

/** How likely an anchor of this kind has somebody on it. Staff posts are always filled. */
export function occupancy(anchor: AnchorKind): number {
  switch (anchor) {
    case 'serve':
      return 1
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

/** What a kind of building keeps lying about. */
const STOCK: Partial<Record<BuildingKind, readonly ItemArchetype[]>> = {
  bar: ['bottle', 'glass', 'ledger', 'cash'],
  cafe: ['cup', 'plate', 'ledger'],
  restaurant: ['plate', 'bottle', 'ledger'],
  shop: ['box', 'parcel', 'cash', 'key'],
  market: ['crate', 'parcel', 'cash'],
  house: ['book', 'phone', 'painting', 'key'],
  apartment: ['book', 'radio', 'key'],
  office: ['ledger', 'envelope', 'briefcase', 'keycard'],
  workshop: ['toolbox', 'wrench', 'fuelcan'],
  warehouse: ['crate', 'box', 'parcel'],
  clinic: ['medkit', 'ledger'],
  hotel: ['key', 'bag', 'envelope'],
  station: ['bag', 'parcel'],
  chapel: ['book', 'statue'],
}

/** Everything this kind of building could have lying about. */
export function stockOf(building: BuildingKind): readonly ItemArchetype[] {
  return STOCK[building] ?? ['box']
}

/** What is lying around in one of them, and whether it belongs to someone. */
export function itemsFor(building: BuildingKind, rng: Rng): ItemArchetype[] {
  const pool = stockOf(building)
  const count = rng.int(1, Math.min(4, pool.length + 1))
  return rng.shuffle(pool).slice(0, count)
}

/** How much of the player an item takes to carry. */
export function bulkOf(archetype: ItemArchetype): 'pocket' | 'bag' | 'two-handed' {
  const twoHanded: readonly ItemArchetype[] = ['crate', 'statue', 'painting', 'fuelcan']
  const bagged: readonly ItemArchetype[] = ['box', 'parcel', 'bag', 'briefcase', 'toolbox', 'medkit', 'radio']
  if (twoHanded.includes(archetype)) return 'two-handed'
  if (bagged.includes(archetype)) return 'bag'
  return 'pocket'
}
