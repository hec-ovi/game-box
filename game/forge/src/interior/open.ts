import type { Rng } from '@gb/kit'
import type { BuildingKind } from '@gb/world'
import { DoorBudget } from './budget.ts'
import { drawOf, NEEDS, pullOf } from './draw.ts'

/**
 * Which of a town's buildings you can walk into.
 *
 * How many open is `budget.ts`; what a place is worth is `draw.ts`. This is the
 * pick: given a number of doors to spend, which ones.
 */

/**
 * How far the seed may lift one door over another. Wide enough that a chapel on
 * the square sometimes opens and a shop out at the ring road sometimes does not,
 * so a town is not a list of its businesses.
 */
const NUDGE = 5

/**
 * What a door on an avenue is worth: as much as moving it from the edge of town
 * to halfway in. It is the same kind of fact as nearness, the traffic goes past
 * it, and a door can have both. It stays under what the place itself is worth,
 * because a lock-up on the avenue is still a lock-up.
 */
const SPINE = 1

/** A building that has gone up, before anybody has decided whether it opens. */
export interface Frontage {
  /** The caller's handle for it; it is what comes back in the set. */
  readonly id: string
  readonly kind: BuildingKind
  /** How near the middle of town it stands, 1 at the centre and 0 at the edge. */
  readonly nearness: number
  /** Whether its door is on an avenue: the spine everybody walks and drives. */
  readonly onAvenue: boolean
}

/** The town these buildings are joining: everything already up, and what of it opens. */
export interface Town {
  /** Buildings already standing, this batch not counted. */
  readonly built: number
  /** The kinds of place already open, which is what the town's needs are measured against. */
  readonly open: readonly BuildingKind[]
}

/**
 * Which of a batch of buildings open, in the order they were put up.
 *
 * The town gets an allowance (`budget.ts`), and this batch spends what is left
 * of it. The pick inside the batch is what the place
 * has to offer, how near the middle of town it stands, whether it is on an
 * avenue (a door on the way to everywhere gets tried, one at the edge does not),
 * and a seeded nudge so the
 * same town twice over is not the same list of shops. Whatever the ranking says,
 * a town still ends up with somewhere to sit, buy, sleep and work, because those
 * come out of the allowance first, and any of them the town already has open is
 * not bought twice.
 */
export function openDoors(frontages: readonly Frontage[], rng: Rng, town: Town): ReadonlySet<string> {
  if (!frontages.length) return new Set()
  const budget = new DoorBudget({ built: town.built, open: town.open.length }, frontages.length, rng)

  const scored = frontages.map((frontage, at) => ({
    frontage,
    at,
    score: pullOf(frontage.kind) + frontage.nearness * 2 + (frontage.onAvenue ? SPINE : 0) + rng.range(0, NUDGE),
  }))
  // two doors worth exactly the same open in the order they were put up
  scored.sort((a, b) => b.score - a.score || a.at - b.at)

  const open = new Set<string>()
  const standing = town.open.map(drawOf)
  for (const [, met] of NEEDS) {
    if (open.size >= budget.spare) break
    if (standing.some(met)) continue
    const best = scored.find((candidate) => !open.has(candidate.frontage.id) && met(drawOf(candidate.frontage.kind)))
    if (best) open.add(best.frontage.id)
  }
  for (const candidate of scored) {
    if (open.size >= budget.spare) break
    open.add(candidate.frontage.id)
  }
  return open
}
