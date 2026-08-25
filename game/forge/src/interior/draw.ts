import { Rng } from '@gb/kit'
import type { Anchor, Charter } from '@gb/world'
import { charterHash } from '../charters/hash.ts'
import { occupancy, roleFor, stockOf } from '../populate.ts'
import { planInterior } from './plan.ts'

/**
 * What a kind of place has to offer somebody who tries its door.
 *
 * Nothing here reads a list of kinds. A door is worth opening for what the
 * place has to offer, which this asks the interior planner: somebody stationed
 * at a post, somewhere to sit, somewhere to sleep, something lying about. A
 * kind a history invents tomorrow is weighed the same way.
 */

/** An anchor somebody is stationed at to do a job, rather than to pass the time. */
const WORKING = 0.6

/** The room a probe interior is planned in: big enough that nothing is left out for want of floor. */
const PROBE = { w: 11.6, h: 13.6 }

/** What a kind of place has to offer somebody who tries its door. */
export interface Draw {
  /** Posts that are always filled: somebody whose job is whoever walks in. */
  readonly counter: number
  /** Posts somebody works at: the people who make the place a place of work. */
  readonly staff: number
  /** Places a body sits: what makes a room read as somewhere people are. */
  readonly seats: number
  /** Places a body sleeps. */
  readonly beds: number
  /** Kinds of loose stock the place carries. */
  readonly stock: number
  /** Whether people live here: a bed in a home is a home somebody can buy. */
  readonly home: boolean
  /** Every place a body stands, sits or lies: none means nobody can be in it at all. */
  readonly posts: number
}

const draws = new Map<string, Draw>()

/**
 * What this kind of place holds, read off an interior its own rooms make rather
 * than off a table somebody has to maintain. Drawn once per charter from a
 * stream seeded on its word, so it is the same everywhere and no town's seed
 * moves it; the memo is keyed on the word and the charter's own digest, so two
 * cities in one process that invent the same word differently share nothing.
 */
export function drawOf(charter: Charter): Draw {
  const key = `${charter.word}:${charterHash(charter)}`
  const known = draws.get(key)
  if (known) return known
  let minted = 0
  const plan = planInterior({
    charter,
    size: PROBE,
    entrance: 'north',
    wants: { dancing: false },
    interiorId: 'interior_0',
    mint: (thing) => `${thing}_${++minted}`,
    rng: new Rng(`open/${charter.word}`),
  })
  const draw: Draw = {
    counter: plan.anchors.filter((anchor) => works(anchor, charter) && occupancy(anchor.kind, charter) === 1).length,
    staff: plan.anchors.filter((anchor) => works(anchor, charter)).length,
    seats: plan.anchors.filter((anchor) => anchor.kind === 'sit' || anchor.kind === 'sit-drink').length,
    beds: plan.anchors.filter((anchor) => anchor.kind === 'sleep').length,
    stock: stockOf(charter).length,
    home: charter.residential,
    posts: plan.anchors.length,
  }
  draws.set(key, draw)
  return draw
}

/** Somebody is stationed here often enough that it is their post, not a seat they took. */
function works(anchor: Anchor, charter: Charter): boolean {
  return roleFor(anchor.kind, charter) !== undefined && occupancy(anchor.kind, charter) >= WORKING
}

/**
 * How much a player has to gain from getting this door open. A counter with
 * somebody permanently behind it counts most, because that is a place whose
 * whole job is whoever walks in; then anybody else who works there, then what
 * is lying about, then whether the place reads as somewhere people are. It puts
 * a shop, a bar and a surgery well above a flat, a lock-up and a chapel, which
 * is the shape a town of frontage wants.
 */
export function pullOf(charter: Charter): number {
  const draw = drawOf(charter)
  return (draw.counter ? 3 : 0) + (draw.staff ? 2 : 0) + (draw.stock >= 3 ? 1 : 0) + (draw.seats + draw.beds >= 3 ? 1 : 0)
}

/**
 * What a town has to have somewhere, whatever else it opens, in the order it
 * gets them. Three of the five are counters with somebody behind them, which is
 * also what the quest writer asks a town for: a place to hand work out from, a
 * second one to be its far side, and a third to send the player between them;
 * the last is a home, because a home that opens is a home the player can buy.
 * So this list is both what a town needs to read as a town and the floor on how
 * many doors it opens.
 */
export const NEEDS: ReadonlyArray<readonly [string, (draw: Draw) => boolean]> = [
  ['somewhere to sit down', (draw) => draw.counter > 0 && draw.seats > 0],
  ['somewhere to buy something', (draw) => draw.counter > 0 && draw.stock > 0],
  ['somewhere to sleep', (draw) => draw.beds > 0],
  ['somewhere to work', (draw) => draw.staff > 0],
  ['somewhere to live', (draw) => draw.home && draw.beds > 0],
]
