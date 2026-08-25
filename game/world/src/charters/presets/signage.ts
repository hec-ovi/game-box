import type { Signage } from '../../model/resolved.ts'

/** The four named signage rows. The presets that differ from their row carry their own values. */
export const QUIET: Signage = { blade: 0, hanging: 0, accents: 1, nameplate: 0.28 }
export const LOUD: Signage = { blade: 0.72, hanging: 0.8, accents: 4, nameplate: 1 }
export const TRADE: Signage = { blade: 0.4, hanging: 0.64, accents: 4, nameplate: 1 }
export const SOBER: Signage = { blade: 0.34, hanging: 0.26, accents: 3, nameplate: 0.75 }
