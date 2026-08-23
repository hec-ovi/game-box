/**
 * What is on a screen, and when.
 *
 * A screen is not a loop of one clip. It runs a schedule: ten second spots
 * drawn from four programme kinds, with a burst of static at every change, and
 * which spot is on comes from the station and the spot number rather than from
 * a list. So a station runs four minutes of different things before it comes
 * round, and two stations are never on the same thing at the same second.
 *
 * Everything here is integer arithmetic on a hash, because the same schedule
 * has to be worked out twice: in TypeScript, where the tests and the probe read
 * it, and in nodes, where the renderer runs it. `hash` is the one three's
 * `hash()` node runs, written out here so both sides agree bit for bit.
 */

/** How many stations there are. A screen is on one of them. */
export const STATIONS = 4

/** Seconds one spot runs for. */
export const SPOT = 10

/** Spots before a station's schedule comes round again. */
export const SPOTS = 24

/** Seconds of a station's whole schedule. */
export const CYCLE = SPOT * SPOTS

/** Seconds of static at a change of spot. */
export const SWITCH = 0.4

/** The kinds of thing a spot can be, in the order `programmeAt` numbers them. */
export const PROGRAMMES = ['news', 'market', 'advert', 'camera'] as const

/**
 * three's `hash()` node, in TypeScript: the PCG word hash, on the integer part
 * of the seed. Integer operations throughout, so the number the CPU works out
 * and the number the GPU works out are the same number and not nearly it.
 */
export function hashOf(seed: number): number {
  const state = (Math.imul(seed >>> 0, 747796405) + 2891336453) >>> 0
  const word = Math.imul((state >>> ((state >>> 28) + 4)) ^ state, 277803737) >>> 0
  return (((word >>> 22) ^ word) >>> 0) / 2 ** 32
}

/** Where in its schedule a screen is: which spot, and how many seconds into it. */
export interface Spot {
  readonly spot: number
  readonly into: number
}

/** Where a screen at this phase is at this second. */
export function spotAt(seconds: number, phase: number): Spot {
  const at = (seconds + phase * CYCLE) % CYCLE
  const spot = Math.floor(at / SPOT)
  return { spot, into: at - spot * SPOT }
}

/** Which of the four programme kinds a station is running in a given spot. */
export function programmeAt(station: number, spot: number): number {
  return Math.floor(hashOf(spot + station * 1024) * PROGRAMMES.length)
}
