import { METRICS } from '@gb/world'

/** A horizontal slice of the facade: one storey of wall. */
export interface Band {
  readonly base: number
  readonly height: number
}

/** Below this a 3 m module is squashed too hard to look like itself. */
const MIN_BAND = 2.4

/**
 * Cuts a building's height into storeys. The ground floor is the tall one the
 * scale contract asks for, and it is the only band that closes with a separate
 * metre-tall piece, because the kit has one and it is exactly a shopfront
 * fascia. The storeys above stretch their 3 m module the 7% it takes to reach
 * 3.2 m, which is cheaper to look at than a squashed filler strip.
 */
export function bandsOf(storeys: number, height: number): Band[] {
  const ground = METRICS.building.groundFloorHeight
  const upper = storeys > 1 ? (height - ground) / (storeys - 1) : height
  const even = upper < MIN_BAND
  const bands: Band[] = []
  let base = 0
  for (let i = 0; i < storeys; i++) {
    const band = even ? height / storeys : i === 0 ? ground : upper
    bands.push({ base, height: band })
    base += band
  }
  return bands
}
