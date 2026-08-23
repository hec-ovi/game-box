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

/** Side jobs per place with somebody in it. */
const PER_PLACE = 0.4

/** How far a town's appetite for work swings either side of that, on the seed. */
const SWING = 0.3

const FEWEST = 2

/**
 * How much side work a town has in it: not how many blocks it was cut into, but
 * how many people are standing in it, how busy a place of this kind is, and how
 * the seed feels that day. It is a density, so a street in a city has about as
 * much going on as a street in a village and a city has more of both.
 *
 * The only ceiling is what the town can actually book: two jobs per person who
 * gives work, one unclaimed thing per job. That grows with the town, so a big
 * city is never told it has as little to do as a small one.
 */
export function questDemand(summary: WorldSummary, rng: Rng): number {
  const cast = new CityCast(summary)
  const busy = BUSY[flavourOf(summary.theme)]
  const wanted = Math.round(cast.peopled.length * PER_PLACE * busy * rng.range(1 - SWING, 1 + SWING))
  return Math.max(FEWEST, Math.min(cast.capacity, wanted))
}
