import type { Rng } from '@gb/kit'
import type { WorldSummary } from '../narrator.ts'
import { flavourOf, type Flavour } from '../theme/flavour.ts'

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

/** Side quests per person standing in a shop, bar or front room. */
const PER_PERSON = 0.4

const FEWEST = 2
const MOST = 24

/**
 * How much side work a town has in it: not how many blocks it was cut into, but
 * how many people are standing in it, how much is lying around to be carried,
 * and how busy a place of this kind is.
 */
export function questDemand(summary: WorldSummary, rng: Rng): number {
  const peopled = summary.places.filter((place) => place.npcs.length > 0).length
  const stocked = summary.places.reduce((total, place) => total + place.items.length, 0)
  const carried = Math.min(peopled, stocked / 2)
  const wanted = Math.round(carried * PER_PERSON * BUSY[flavourOf(summary.theme)]) + rng.int(-1, 2)
  return Math.max(FEWEST, Math.min(MOST, wanted))
}
