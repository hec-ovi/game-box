import type { Rng } from '@gb/kit'
import type { AnchorKind, BuildingKind, ItemArchetype, NpcRole } from '@gb/world'

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

/** What is lying around in this kind of building, and whether it belongs to someone. */
export function itemsFor(building: BuildingKind, rng: Rng): ItemArchetype[] {
  const table: Partial<Record<BuildingKind, readonly ItemArchetype[]>> = {
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
  const pool = table[building] ?? ['box']
  const count = rng.int(1, Math.min(4, pool.length + 1))
  return rng.shuffle(pool).slice(0, count)
}
