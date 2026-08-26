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

/** The services you are served across rather than received at: what a counter sells over. */
const SOLD_OVER: readonly Charter['service'][] = ['counter', 'stalls']

/** What a kind of place has to offer somebody who tries its door. */
export interface Draw {
  /** Counters somebody is always behind: posts whose job is whoever walks in. */
  readonly serves: number
  /** Whether that counter is one you buy across rather than one you are received at, so a job, a thing and a deed can change hands over it. */
  readonly trades: boolean
  /** Posts somebody works at: the people who make the place a place of work. */
  readonly staff: number
  /** Places a body sits: what makes a room read as somewhere people are. */
  readonly seats: number
  /** Places a body sleeps. */
  readonly beds: number
  /** Kinds of loose stock the place carries. */
  readonly stock: number
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
  const serves = plan.anchors.filter((anchor) => anchor.kind === 'serve').length
  const draw: Draw = {
    serves,
    trades: serves > 0 && SOLD_OVER.includes(charter.service),
    staff: plan.anchors.filter((anchor) => works(anchor, charter)).length,
    seats: plan.anchors.filter((anchor) => anchor.kind === 'sit' || anchor.kind === 'sit-drink').length,
    beds: plan.anchors.filter((anchor) => anchor.kind === 'sleep').length,
    stock: stockOf(charter).length,
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
 * is the shape a town of frontage wants. A guard on a door is not a counter:
 * a lock-up with a watchman scores as the lock-up it is.
 */
export function pullOf(charter: Charter): number {
  const draw = drawOf(charter)
  return (draw.serves ? 3 : 0) + (draw.staff ? 2 : 0) + (draw.stock >= 3 ? 1 : 0) + (draw.seats + draw.beds >= 3 ? 1 : 0)
}

/** A question about what a place holds, and what to call the answer. */
export type Need = readonly [string, (draw: Draw) => boolean]

/**
 * The doors a town opens before anything else claims one. A city opens three
 * places and two of them are counters you buy across: one is where work is
 * handed over, a thing is bought and a deed is sold, and one is a room with
 * seats in it and somebody behind the bar, which is the room a town is met in.
 * One place answers both often enough (a bar sells drink and seats you), and
 * then the door it saves goes to the kind of place the town's history is about.
 * The third is a home, which `homesFor` in `open.ts` keeps back.
 */
export const KEYSTONES: readonly Need[] = [
  ['somewhere to buy something over a counter', (draw) => draw.trades && draw.stock > 0],
  ['somewhere to sit down and be served', (draw) => draw.trades && draw.seats > 0],
]

/** What a town takes next when it has doors over its keystones, its story and its home. */
export const WANTS: readonly Need[] = [
  ['somewhere people work', (draw) => draw.staff >= 3],
  ['somewhere to sleep', (draw) => draw.beds > 0],
]
