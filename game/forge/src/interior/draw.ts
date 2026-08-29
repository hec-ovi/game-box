import { Rng } from '@gb/kit'
import type { Anchor, Charter } from '@gb/world'
import { charterHash } from '../charters/hash.ts'
import { occupancy, roleFor, stockOf } from '../populate.ts'
import { planInterior } from './plan.ts'

/**
 * What a kind of place turns out to hold, read off an interior its own rooms
 * make rather than off a table somebody has to maintain.
 *
 * Nothing here reads a word. It asks the interior planner: somebody stationed
 * at a post, somewhere to sit, somewhere to sleep, something lying about. It is
 * the gate a charter goes through before a plot may take its word (a charter
 * whose rooms plan into an interior nobody can stand in is refused), and it is
 * how a kind of place a history invents is measured against the presets.
 */

/** An anchor somebody is stationed at to do a job, rather than to pass the time. */
const WORKING = 0.6

/** The room a probe interior is planned in: big enough that nothing is left out for want of floor. */
const PROBE = { w: 11.6, h: 13.6 }

/** What a kind of place has to offer somebody who tries its door. */
export interface Draw {
  /** Counters somebody is always behind: posts whose job is whoever walks in. */
  readonly serves: number
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
  const draw: Draw = {
    serves: plan.anchors.filter((anchor) => anchor.kind === 'serve').length,
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
