import type { Rng } from '@gb/kit'
import type { CastPlace } from './cast.ts'

/**
 * How far a job sends the player, in metres. A block runs 40 to 50 m from one
 * street to the next, so these are the next street over, a few streets away,
 * and the far side of town, in that order of likelihood.
 *
 * They are metres rather than a share of the map on purpose: a city ten times
 * the size of a village then reads as ten times as many neighbourhoods, not as
 * one village where every errand is a half-hour walk.
 */
const REACH: ReadonlyArray<readonly [number, number]> = [
  [90, 10],
  [250, 8],
  [Infinity, 1],
]

/**
 * How many candidates a pick looks at before it stops holding out for a near
 * one. It is a few hundred rather than a few because only about one place in
 * thirty is within the closest reach in a city of a few thousand: look at
 * twenty and half the picks would give up and take the far side of town.
 */
const TRIES = 240

/** Metres between two street doors: what a walk actually costs the player. */
export function metresBetween(from: CastPlace, to: CastPlace): number {
  if (!from.door || !to.door) return 0
  return Math.hypot(from.door.x - to.door.x, from.door.z - to.door.z)
}

/**
 * Picks one candidate out of a pool, preferring one within a walk of `from`.
 * Sampling rather than sorting or filtering, so a town of three thousand places
 * is picked from as quickly as one of twenty, and the pool may hold candidates
 * that no longer qualify: `ok` is what decides. Nothing near it means it takes
 * whatever the pool still holds rather than writing no quest at all; nothing at
 * all in that many looks means the town has run out and the writer moves on.
 */
export function pickNear<T>(
  rng: Rng,
  pool: readonly T[],
  placeOf: (candidate: T) => CastPlace,
  ok: (candidate: T) => boolean,
  from?: CastPlace,
): T | undefined {
  if (!pool.length) return undefined
  const reach = from ? rng.weighted(REACH) : Infinity
  for (let tries = 0; tries < TRIES; tries++) {
    const candidate = rng.pick(pool)
    if (ok(candidate) && (!from || metresBetween(from, placeOf(candidate)) <= reach)) return candidate
  }
  for (let tries = 0; tries < TRIES; tries++) {
    const candidate = rng.pick(pool)
    if (ok(candidate)) return candidate
  }
  return undefined
}
