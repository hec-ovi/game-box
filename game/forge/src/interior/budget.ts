import type { Rng } from '@gb/kit'
import { NEEDS } from './draw.ts'

/**
 * How many doors a town opens.
 *
 * A city is mostly frontage. Every plot gets a facade, a sign and a name from
 * the moment it goes up, but only some of them open, because a town where every
 * door leads to a generated room is a town with nothing behind any of them, and
 * because an interior is most of what a city costs to build and to carry.
 *
 * The number is worked out for the whole town, never for the batch of buildings
 * that happens to be going up. Ten buildings added to a city are worth about one
 * more door between them, not a town's worth of doors of their own.
 */

/** Doors that open, per building the town has up. */
const SHARE = 0.12

/** How far the seed swings that either way. */
const SWING = 0.3

/**
 * The fewest a town opens, however small it is: the four things a town needs.
 * Three of them are counters with somebody behind them, which is exactly what
 * the quest writer asks a town for, so a town that opens its needs can hold a
 * line of work. It is a floor on the town, not on a batch.
 */
const FEWEST = NEEDS.length

/**
 * The most a town may open and still be a town of frontage: strictly fewer than
 * half of it. A town of one or two buildings opens one anyway, because a town
 * with no door at all is not a town.
 */
export const mostOpen = (buildings: number): number => Math.max(1, Math.ceil(buildings / 2) - 1)

/** What a town already has up, before this batch of buildings. */
export interface Standing {
  /** Buildings already standing. */
  readonly built: number
  /** How many of them already open. */
  readonly open: number
}

/**
 * What a town of this size may have open, and how much of that this batch gets
 * to spend.
 *
 * Where a town is too small to hold both the floor and the majority-shut
 * ceiling, the ceiling wins: a hamlet of six buildings opens two, not four,
 * because "most of them are frontage" is the promise and the floor is only what
 * a town would like.
 */
export class DoorBudget {
  /** Doors the whole town may have open once this batch is up. */
  readonly town: number
  /** How many of this batch may open: the town's allowance, less what already does. */
  readonly spare: number

  constructor(standing: Standing, adding: number, rng: Rng) {
    const buildings = standing.built + adding
    const wanted = Math.round(buildings * SHARE * rng.range(1 - SWING, 1 + SWING))
    this.town = Math.min(mostOpen(buildings), Math.max(FEWEST, wanted))
    this.spare = Math.max(0, Math.min(adding, this.town - standing.open))
  }
}
