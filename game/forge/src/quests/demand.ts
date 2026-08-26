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
 * The most side work a town writes, however many people are standing in it.
 *
 * Work follows the cast and the cast follows how many places open, so a city
 * that opens ninety doors holds five hundred and sixty people and would write
 * three hundred and sixty jobs. Nobody plays three hundred and sixty side jobs,
 * and every one is a call the model answers before the city can be walked into.
 *
 * Sixty is past what a player finishes, and it is set above what a town of ten
 * blocks asks for on its own, so it only ever binds on a city: below that the
 * count still swings with the cast and the seed, and two towns of one size are
 * still not the same town.
 */
const MOST_JOBS = 60

/**
 * How much side work a town has in it: not how many blocks it was cut into, but
 * how many people are standing in it, how busy a place of this kind is, and how
 * the seed feels that day.
 *
 * Two ceilings hold it. What the town can actually book (two jobs per person
 * who gives work, one unclaimed thing per job), and `MOST_JOBS`, which is what
 * anybody would play. A big city is a bigger place to walk around and to find
 * people in; it is not a longer list of errands.
 */
export function questDemand(summary: WorldSummary, rng: Rng): number {
  const cast = new CityCast(summary)
  const busy = BUSY[flavourOf(summary.theme)]
  const wanted = Math.round(cast.people.length * PER_PERSON * busy * rng.range(1 - SWING, 1 + SWING))
  return Math.max(FEWEST, Math.min(cast.capacity, MOST_JOBS, wanted))
}
