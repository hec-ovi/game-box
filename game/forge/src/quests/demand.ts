import type { Rng } from '@gb/kit'
import type { WorldSummary } from '../narrator.ts'
import { flavourOf, type Flavour } from '../theme/flavour.ts'
import { CityCast } from './cast.ts'

/** How much work a town of each flavour has going on. */
const BUSY: Record<Flavour, number> = {
  neon: 1.3,
  industrial: 1.15,
  coastal: 1.1,
  frontier: 1,
  plain: 1,
  alpine: 0.85,
  agrarian: 0.8,
}

/** Side jobs per person standing in the town. */
const PER_PERSON = 0.5

/** How far a town's appetite for work swings either side of that, on the seed. */
const SWING = 0.3

const FEWEST = 2

/**
 * How much side work a town has in it: not how many blocks it was cut into, but
 * how many people are standing in it, how busy a place of this kind is, and how
 * the seed feels that day. A city's size is scenery and its people are a fixed
 * cast, so how much there is to do follows the cast and two cities of very
 * different sizes have about as much going on.
 *
 * The only ceiling is what the town can actually book: two jobs per person who
 * gives work, one unclaimed thing per job.
 */
export function questDemand(summary: WorldSummary, rng: Rng): number {
  const cast = new CityCast(summary)
  const busy = BUSY[flavourOf(summary.theme)]
  const wanted = Math.round(cast.people.length * PER_PERSON * busy * rng.range(1 - SWING, 1 + SWING))
  return Math.max(FEWEST, Math.min(cast.capacity, wanted))
}
