import { ResolvedCharterSchema, type ResolvedCharter } from '../../model/resolved.ts'
import { clinic, chapel, station } from './civic.ts'
import { bar, cafe, restaurant } from './hospitality.ts'
import { apartment, hotel, house } from './residential.ts'
import { market, shop } from './retail.ts'
import { office, warehouse, workshop } from './work.ts'

/**
 * The words of the fourteen shipped presets, in the order a town's mix has
 * always drawn them: the order and length of this list are part of every
 * existing city's identity, so neither moves. A city that declares no
 * charters of its own is built from exactly these.
 */
export const BUILDING_KINDS = [
  'house',
  'apartment',
  'bar',
  'cafe',
  'restaurant',
  'shop',
  'market',
  'office',
  'workshop',
  'warehouse',
  'clinic',
  'hotel',
  'station',
  'chapel',
] as const

export type BuildingKind = (typeof BUILDING_KINDS)[number]

const PRESETS: Record<BuildingKind, ResolvedCharter> = {
  house,
  apartment,
  bar,
  cafe,
  restaurant,
  shop,
  market,
  office,
  workshop,
  warehouse,
  clinic,
  hotel,
  station,
  chapel,
}

/**
 * The fourteen presets, each carrying the resolved values it has always been
 * drawn with, read through the same schema a file's charters are, so they are
 * in the same canonical form.
 */
export const SHIPPED_CHARTERS: readonly ResolvedCharter[] = BUILDING_KINDS.map((word) => ResolvedCharterSchema.parse(PRESETS[word]))
