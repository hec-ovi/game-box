import type { Rng } from '@gb/kit'
import { DoorBudget } from './budget.ts'

/**
 * Which of a town's buildings you can walk into.
 *
 * How many open is `budget.ts`. This is the pick, and it is architecture: a
 * door is chosen for where it stands and how much room is behind it, because
 * nothing here knows what any of these buildings is. What each one turns out to
 * be is the writing's, and what the town needs its doors to be is handed over
 * with them (`needs.ts`).
 */

/**
 * How far the seed may lift one door over another. Wide enough that the door on
 * the square sometimes opens and the one at the ring road sometimes does not,
 * so a town is not the same three corners twice.
 */
const NUDGE = 5

/**
 * What a door on an avenue is worth: as much as moving it from the edge of town
 * to halfway in. The traffic goes past it, and a door can have both.
 */
const SPINE = 1

/**
 * What the roomiest plot in town is worth over the tightest. A city opens a
 * handful of places and every one of them has to hold people, stock and a job
 * or two, so the door that opens is the one with floor behind it: a 6 by 8 plot
 * seats twice what a 3 by 5 seats.
 */
const ROOMY = 2

/** What nearness to the middle of town is worth: the doors a player actually tries. */
const MIDDLE = 2

/** Where something stands on the grid, in cells. */
export interface Spot {
  readonly x: number
  readonly y: number
}

/** A building that has gone up, before anybody has decided whether it opens. */
export interface Frontage {
  /** The caller's handle for it; it is what comes back in the set. */
  readonly id: string
  /** Where its door stands, which is what the doors are spread across. */
  readonly spot: Spot
  /** Cells of footprint: how much room there is behind the door. */
  readonly floor: number
  /** How near the middle of town it stands, 1 at the centre and 0 at the edge. */
  readonly nearness: number
  /** Whether its door is on an avenue: the spine everybody walks and drives. */
  readonly onAvenue: boolean
}

/** The town these buildings are joining: everything already up, and where it already opens. */
export interface Town {
  /** Buildings already standing, this batch not counted. */
  readonly built: number
  /** Where the town already opens, which is what the spacing is measured against. */
  readonly open: readonly Spot[]
  /** The longest side of the town in cells: what its doors are spread across. */
  readonly span: number
  /** How many places this city opens, whatever its size. */
  readonly places: number
}

/**
 * Which of a batch of buildings open, in the order they were put up.
 *
 * The city has a number of places and this batch spends what is left of it. The
 * ranking is how much floor there is behind a door, how near the middle of town
 * it stands, whether it is on an avenue (a door on the way to everywhere gets
 * tried, one at the edge does not), and a seeded nudge so the same town twice
 * over is not the same three doors. Whatever it says, they end up a walk apart
 * rather than on one corner.
 */
export function openDoors(frontages: readonly Frontage[], rng: Rng, town: Town): ReadonlySet<string> {
  if (!frontages.length) return new Set()
  const budget = new DoorBudget({ built: town.built, open: town.open.length }, frontages.length, town.places)
  const picker = new Picker(frontages, rng, town, budget)
  while (picker.room()) if (!picker.take()) break
  return picker.open
}

/** One building in the ranking. */
interface Ranked {
  readonly frontage: Frontage
  readonly score: number
}

/**
 * The town's doors, taken one at a time: every pick is the best door left, held
 * to a walk away from the doors already picked. The spacing gives way where the
 * town has nothing else to offer, because a door on the wrong corner beats no
 * door at all.
 */
class Picker {
  /** The doors picked so far. */
  readonly open = new Set<string>()

  readonly #scored: readonly Ranked[]
  readonly #spots: Spot[]
  readonly #apart: number
  readonly #spare: number

  constructor(frontages: readonly Frontage[], rng: Rng, town: Town, budget: DoorBudget) {
    const biggest = Math.max(...frontages.map((frontage) => frontage.floor))
    this.#scored = frontages.map((frontage) => ({
      frontage,
      score: frontage.nearness * MIDDLE + (frontage.floor / biggest) * ROOMY + (frontage.onAvenue ? SPINE : 0) + rng.range(0, NUDGE),
    }))
    this.#spots = [...town.open]
    this.#apart = town.span / (budget.town + 1)
    this.#spare = budget.spare
  }

  /** Whether this batch may open another door. */
  room(): boolean {
    return this.open.size < this.#spare
  }

  /** Opens the best door left, a walk from the others where the town has one. */
  take(): boolean {
    const best = this.#best(true) ?? this.#best(false)
    if (!best) return false
    this.open.add(best.frontage.id)
    this.#spots.push(best.frontage.spot)
    return true
  }

  #best(spaced: boolean): Ranked | undefined {
    let best: Ranked | undefined
    for (const one of this.#scored) {
      if (this.open.has(one.frontage.id)) continue
      if (spaced && this.#crowds(one.frontage.spot)) continue
      // two doors worth exactly the same open in the order they were put up
      if (!best || one.score > best.score) best = one
    }
    return best
  }

  /** Whether this door would stand on top of one the town already opens. */
  #crowds(spot: Spot): boolean {
    return this.#spots.some((other) => Math.hypot(spot.x - other.x, spot.y - other.y) < this.#apart)
  }
}
