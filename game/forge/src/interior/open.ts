import type { Rng } from '@gb/kit'
import type { ResolvedCharter, Word } from '@gb/world'
import { DoorBudget } from './budget.ts'
import { drawOf, KEYSTONES, pullOf, WANTS, type Draw, type Need } from './draw.ts'

/**
 * Which of a town's buildings you can walk into.
 *
 * How many open is `budget.ts`, and it is a number the city carries rather than
 * a share of its plots; what a place is worth is `draw.ts`. This is the pick:
 * given a handful of doors to spend, which ones, and where.
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

/**
 * What the town's own story is worth on the one plot it lands on. As much as
 * the seed's whole nudge, so the kind of place a history demands takes the door
 * it can answer rather than waiting for a door to be spare. It goes on the best
 * plot of that kind and no other: scoring every plot of a demanded kind fills a
 * town with hotels.
 */
const STORIED = 5

/**
 * What each door of a kind the town already opens costs the next one of the
 * same kind. A player meets a town one door at a time, and six restaurants is
 * one restaurant met six times.
 */
const AGAIN = 1.5

/**
 * And the most it can ever cost. It is one tier of what a place has to offer,
 * so a repeat gives way to a shop, a surgery or a workshop that has not opened
 * yet and never to a lock-up: the point is to spread a town's doors over the
 * places worth walking into, not to open worse ones.
 */
const MOST_AGAIN = 2

/**
 * What the roomiest plot in town is worth over the tightest. A city opens a
 * handful of places and every one of them has to hold people, stock and a job
 * or two, so the door that opens is the one with floor behind it: the same
 * charter on a 6 by 8 plot seats twice what it seats on a 3 by 5.
 */
const ROOMY = 2

/** The fewest doors a town opens before one of them is a home: a hamlet with two spends both on what a town needs. */
const HOME_AT = 3

/** And one more home for every this many places a brief asks to open, so a wider city has one that stays somebody's as well as one on the market. */
const PER_HOME = 8

/** How many homes a city opens, whatever its size: the one the player buys, and one more per handful of places. */
export const homesFor = (open: number): number => (open >= HOME_AT ? 1 + Math.floor(open / PER_HOME) : 0)

/** Where something stands on the grid, in cells. */
export interface Spot {
  readonly x: number
  readonly y: number
}

/** A building that has gone up, before anybody has decided whether it opens. */
export interface Frontage {
  /** The caller's handle for it; it is what comes back in the set. */
  readonly id: string
  /** What kind of place it is. */
  readonly charter: ResolvedCharter
  /** Where its door stands, which is what the doors are spread across. */
  readonly spot: Spot
  /** Cells of footprint: how much room there is behind the door. */
  readonly floor: number
  /** How near the middle of town it stands, 1 at the centre and 0 at the edge. */
  readonly nearness: number
  /** Whether its door is on an avenue: the spine everybody walks and drives. */
  readonly onAvenue: boolean
  /** Whether the town's history demands this kind of place. */
  readonly storied: boolean
}

/** A door the town already has open. */
export interface OpenPlace {
  readonly charter: ResolvedCharter
  readonly spot: Spot
}

/** The town these buildings are joining: everything already up, and what of it opens. */
export interface Town {
  /** Buildings already standing, this batch not counted. */
  readonly built: number
  /** The doors already open, which is what the town's needs and its spacing are measured against. */
  readonly open: readonly OpenPlace[]
  /** The longest side of the town in cells: what its doors are spread across. */
  readonly span: number
  /** How many places this city opens, whatever its size. */
  readonly places: number
}

/**
 * Which of a batch of buildings open, in the order they were put up.
 *
 * The city has a number of places and this batch spends what is left of it. Its
 * keystones go first (`KEYSTONES` in `draw.ts`: a counter to buy over, a room
 * with seats and somebody serving), then the kind of place the town's history
 * is about, then what else a town wants, then the home the player buys, then
 * the ranking. The ranking is what the place has to offer, how much floor there
 * is behind its door, how near the middle of town it stands, whether it is on
 * an avenue (a door on the way to everywhere gets tried, one at the edge does
 * not), whether the town's own story is about that kind of place, and a seeded
 * nudge so the same town twice over is not the same list of shops. Whatever it
 * says, the doors end up a walk apart rather than on one corner.
 */
export function openDoors(frontages: readonly Frontage[], rng: Rng, town: Town): ReadonlySet<string> {
  if (!frontages.length) return new Set()
  const budget = new DoorBudget({ built: town.built, open: town.open.length }, frontages.length, town.places)
  const picker = new Picker(frontages, rng, town, budget)
  const homes = homesFor(budget.town)
  /** Doors still owed to homes: what every pass before them keeps back. */
  const owed = (): number => Math.max(0, homes - picker.homes)
  const answer = (needs: readonly Need[]): void => {
    for (const [, met] of needs) {
      if (!picker.room(owed())) break
      if (picker.holds(met)) continue
      picker.take((frontage) => met(drawOf(frontage.charter)))
    }
  }

  answer(KEYSTONES)
  // a kind of place the town's history is about: the door the story means the
  // player to try, taken out of whatever the keystones did not spend
  const stories = Math.min(picker.stories, Math.max(0, budget.spare - picker.open.size - owed()))
  for (let told = 0; told < stories && picker.room(owed()); told++) {
    if (!picker.take((frontage, open) => frontage.storied && open === 0)) break
  }
  answer(WANTS)
  while (picker.room(0) && picker.homes < homes) if (!picker.take((frontage) => frontage.charter.residential)) break
  // whatever is left goes over as many different kinds of place as the town has
  while (picker.room(0)) if (!picker.take(() => true)) break
  return picker.open
}

/** Which doors a pass will take: the building, and how many of its kind the town already opens. */
type Fits = (frontage: Frontage, open: number) => boolean

/** One building in the ranking. */
interface Ranked {
  readonly frontage: Frontage
  /** Where it stands in the batch, which is how two equal doors are told apart. */
  readonly at: number
  readonly score: number
}

/**
 * The town's doors, taken one at a time.
 *
 * Every pick is the best door left, charged for every door of its own kind the
 * town already opens and held to a walk away from the doors already picked. The
 * spacing gives way where the town has nothing else to offer, because a door
 * on the wrong corner beats no door at all.
 */
class Picker {
  /** The doors picked so far. */
  readonly open = new Set<string>()

  #homes: number
  #scored: readonly Ranked[]
  #stories: number
  #standing: Draw[]
  #already = new Map<Word, number>()
  #spots: Spot[]
  #apart: number
  #spare: number

  constructor(frontages: readonly Frontage[], rng: Rng, town: Town, budget: DoorBudget) {
    const biggest = Math.max(...frontages.map((frontage) => frontage.floor))
    const told = crowned(
      frontages.map((frontage, at) => ({
        frontage,
        at,
        score:
          pullOf(frontage.charter) +
          frontage.nearness * 2 +
          (frontage.floor / biggest) * ROOMY +
          (frontage.onAvenue ? SPINE : 0) +
          rng.range(0, NUDGE),
      })),
    )
    this.#scored = told.scored
    this.#stories = told.stories
    this.#standing = town.open.map((one) => drawOf(one.charter))
    this.#spots = town.open.map((one) => one.spot)
    this.#homes = town.open.filter((one) => one.charter.residential).length
    for (const one of town.open) this.#already.set(one.charter.word, (this.#already.get(one.charter.word) ?? 0) + 1)
    this.#apart = town.span / (budget.town + 1)
    this.#spare = budget.spare
  }

  /** Whether this batch may open another door and still keep this many back. */
  room(reserved: number): boolean {
    return this.open.size + reserved < this.#spare
  }

  /** Whether something the town already opens answers this. */
  holds(met: (draw: Draw) => boolean): boolean {
    return this.#standing.some(met)
  }

  /** How many kinds of place the town's history is about and this batch could open. */
  get stories(): number {
    return this.#stories
  }

  /** How many of the doors picked so far are homes. */
  get homes(): number {
    return this.#homes
  }

  /** Opens the best door that fits, a walk from the others where the town has one. */
  take(fits: Fits): boolean {
    const best = this.#best(fits, true) ?? this.#best(fits, false)
    if (!best) return false
    const { charter } = best.frontage
    this.open.add(best.frontage.id)
    this.#standing.push(drawOf(charter))
    this.#spots.push(best.frontage.spot)
    this.#already.set(charter.word, (this.#already.get(charter.word) ?? 0) + 1)
    if (charter.residential) this.#homes++
    return true
  }

  #best(fits: Fits, spaced: boolean): Ranked | undefined {
    let best: Ranked | undefined
    let worth = -Infinity
    for (const one of this.#scored) {
      if (this.open.has(one.frontage.id) || !fits(one.frontage, this.#already.get(one.frontage.charter.word) ?? 0)) continue
      if (spaced && this.#crowds(one.frontage.spot)) continue
      const score = one.score - Math.min(AGAIN * (this.#already.get(one.frontage.charter.word) ?? 0), MOST_AGAIN)
      // two doors worth exactly the same open in the order they were put up
      if (score > worth) {
        best = one
        worth = score
      }
    }
    return best
  }

  /** Whether this door would stand on top of one the town already opens. */
  #crowds(spot: Spot): boolean {
    return this.#spots.some((other) => Math.hypot(spot.x - other.x, spot.y - other.y) < this.#apart)
  }
}

/** The story's own kinds of place, each lifted on the one plot of it worth opening, and how many kinds those are. */
function crowned(scored: readonly Ranked[]): { scored: readonly Ranked[]; stories: number } {
  const best = new Map<Word, Ranked>()
  for (const one of scored) {
    if (!one.frontage.storied) continue
    const held = best.get(one.frontage.charter.word)
    if (!held || one.score > held.score) best.set(one.frontage.charter.word, one)
  }
  const lifted = new Set([...best.values()].map((one) => one.at))
  if (!lifted.size) return { scored, stories: 0 }
  return { scored: scored.map((one) => (lifted.has(one.at) ? { ...one, score: one.score + STORIED } : one)), stories: lifted.size }
}
