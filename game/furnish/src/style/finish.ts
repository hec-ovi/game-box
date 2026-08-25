import type { BuildingKind } from '@gb/world'
import type { FurnishStyle } from './palette.ts'

/**
 * Which interior language a building is dressed in.
 *
 * The world says what a building is, and the finish follows from that: the
 * places people live in are moulded and warm, everything worked in is machined
 * and cool. Exhaustive over the vocabulary, so a new kind of building has to
 * say which it is before it compiles.
 */
const FINISH: Record<BuildingKind, FurnishStyle> = {
  apartment: 'home',
  house: 'home',
  hotel: 'home',
  bar: 'corpo',
  cafe: 'corpo',
  chapel: 'corpo',
  clinic: 'corpo',
  market: 'corpo',
  office: 'corpo',
  restaurant: 'corpo',
  shop: 'corpo',
  station: 'corpo',
  warehouse: 'corpo',
  workshop: 'corpo',
}

export function finishOf(kind: BuildingKind): FurnishStyle {
  return FINISH[kind]
}
