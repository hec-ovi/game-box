import type { CellKind } from '@gb/world'

/**
 * What it costs to walk over each kind of ground. Sidewalks are cheapest, so
 * pedestrians use them and only cross the road when they have to.
 */
export const WALK_COST: Record<CellKind, number> = {
  sidewalk: 1,
  park: 1.2,
  empty: 1.6,
  street: 3,
  building: Number.POSITIVE_INFINITY,
  mountain: Number.POSITIVE_INFINITY,
  water: Number.POSITIVE_INFINITY,
}
