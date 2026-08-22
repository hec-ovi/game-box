import { METRICS, type CellKind } from '@gb/world'

export interface CrowdOptions {
  /** How many walkers to keep around the player. */
  population: number
  /** New walkers appear between these two distances from the player, in metres. */
  spawnNear: number
  spawnFar: number
  /** Past this distance a walker is retired. Always kept clear of `spawnFar`. */
  retireRadius: number
  /** How far a walker heads on one trip, in metres. */
  tripMin: number
  tripMax: number
  /** How long a walker stands still after arriving, in seconds. */
  pauseMin: number
  pauseMax: number
  /** Walking speed spread, as a fraction of METRICS walk speed. 0.15 is 1.19-1.61 m/s. */
  speedSpread: number
  /** How fast a walker swings round to face where they are going, radians per second. */
  turnRate: number
  /** The closest two bodies ever get, in metres. Nobody steps inside somebody else's. */
  personalSpace: number
  /** How far off a body starts leaning away from other people, in metres. Never below `personalSpace`. */
  avoidRadius: number
  /** How hard that lean is against the pull of the route. At 1 they are an even match when two people touch. */
  avoidStrength: number
  /** After this long boxed in, a walker drops its route and asks for another, in seconds. */
  stuckSeconds: number
  /** How many seconds of traffic a walker looks for before stepping off the kerb. */
  kerbLook: number
  /** Below this speed a hazard is standing still, not coming, in metres per second. */
  hazardSpeed: number
  /** Ground the walkers stand on. Cheapest first: the crowd prefers pavement. */
  pavement: readonly CellKind[]
  /** How high those cells sit above the roadway. Set 0 for flat ground. */
  kerbHeight: number
  /** Longest slice of walking one update may do, in seconds. A stalled tab must not teleport the crowd. */
  maxStep: number
  /** Ceilings per update, so one frame cannot pay for the whole crowd at once. */
  spawnsPerUpdate: number
  routesPerUpdate: number
  /** How many destinations a walker tries before giving up and being retired. */
  routeTries: number
}

export const CROWD_DEFAULTS: CrowdOptions = {
  population: 32,
  spawnNear: 18,
  spawnFar: 45,
  retireRadius: 70,
  tripMin: 20,
  tripMax: 60,
  pauseMin: 1,
  pauseMax: 5,
  speedSpread: 0.15,
  turnRate: 8,
  personalSpace: 0.7,
  avoidRadius: 2.2,
  avoidStrength: 1.6,
  stuckSeconds: 2,
  kerbLook: 2.5,
  hazardSpeed: 0.5,
  pavement: ['sidewalk', 'park'],
  kerbHeight: METRICS.street.curbHeight,
  maxStep: 0.25,
  spawnsPerUpdate: 2,
  routesPerUpdate: 4,
  routeTries: 3,
}

/**
 * Settle the numbers so they cannot contradict each other. A retire radius
 * inside the spawn ring would delete walkers the same frame they appear, and
 * an avoid radius inside personal space would let people touch before they
 * ever started to lean away.
 */
export function resolveOptions(given: Partial<CrowdOptions> = {}): CrowdOptions {
  const merged = { ...CROWD_DEFAULTS, ...given }
  const spawnFar = Math.max(merged.spawnFar, merged.spawnNear)
  const personalSpace = Math.max(merged.personalSpace, 0)
  return {
    ...merged,
    spawnFar,
    retireRadius: Math.max(merged.retireRadius, spawnFar + 5),
    tripMax: Math.max(merged.tripMax, merged.tripMin),
    pauseMax: Math.max(merged.pauseMax, merged.pauseMin),
    personalSpace,
    avoidRadius: Math.max(merged.avoidRadius, personalSpace * 1.5),
  }
}
