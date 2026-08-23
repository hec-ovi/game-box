import type { Rng } from '@gb/kit'
import type { Anchor, AnchorKind, BuildingKind, ItemArchetype, NpcRole } from '@gb/world'

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
  }
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
