import { ResolvedCharterSchema, type ResolvedCharter } from '../../model/resolved.ts'
import { clinic, chapel, station } from './civic.ts'
import { bar, cafe, restaurant } from './hospitality.ts'
import { apartment, hotel, house } from './residential.ts'
import { market, shop } from './retail.ts'
import { office, warehouse, workshop } from './work.ts'

/**
 * The fourteen presets a city that declares no charters of its own is built
 * from, each carrying the resolved values it has always been drawn with and
 * read through the same schema a file's charters are, so they are in the same
 * canonical form. The order is the order a town's mix draws them, and it is
 * part of every existing city's identity, so it does not move.
 */
export const SHIPPED_CHARTERS: readonly ResolvedCharter[] = [
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
].map((preset) => ResolvedCharterSchema.parse(preset))
