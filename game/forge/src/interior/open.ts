import type { Rng } from '@gb/kit'
import type { ResolvedCharter, Word } from '@gb/world'
import { DoorBudget } from './budget.ts'
import { drawOf, NEEDS, pullOf } from './draw.ts'

/**
 * Which of a town's buildings you can walk into.
 *
 * How many open is `budget.ts`; what a place is worth is `draw.ts`. This is the
 * pick: given a number of doors to spend, which ones.
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

/** One home opens in any town, and one more for every this many buildings: what a bigger city has on the market. */
const HOMES_PER = 200

/** How many homes a town of this many buildings opens, whatever their doors are worth: the ones the player can buy and the one somebody lives in. */
export const homesFor = (buildings: number): number => 1 + Math.floor(buildings / HOMES_PER)

/** A building that has gone up, before anybody has decided whether it opens. */
export interface Frontage {
  /** The caller's handle for it; it is what comes back in the set. */
  readonly id: string
  /** What kind of place it is. */
  readonly charter: ResolvedCharter
  /** How near the middle of town it stands, 1 at the centre and 0 at the edge. */
  readonly nearness: number
  /** Whether its door is on an avenue: the spine everybody walks and drives. */
  readonly onAvenue: boolean
  /** Whether the town's history demands this kind of place. */
  readonly storied: boolean
}

/** The town these buildings are joining: everything already up, and what of it opens. */
export interface Town {
  /** Buildings already standing, this batch not counted. */
  readonly built: number
  /** The kinds of place already open, which is what the town's needs are measured against. */
  readonly open: readonly ResolvedCharter[]
}

/**
 * Which of a batch of buildings open, in the order they were put up.
 *
 * The town gets an allowance (`budget.ts`), and this batch spends what is left
 * of it, on as many different kinds of place as it can. The pick inside the batch is what the place
 * has to offer, how near the middle of town it stands, whether it is on an
 * avenue (a door on the way to everywhere gets tried, one at the edge does not),
 * and a seeded nudge so the
 * same town twice over is not the same list of shops. Whatever the ranking says,
 * a town still ends up with somewhere to sit, buy, sleep and work, because those
 * come out of the allowance first, and any of them the town already has open is
 * not bought twice; a bigger town opens more homes, because a home is what the
 * player buys and a city with one on the market is thin; and a kind of place
 * its history demands opens one door next, because a lock-up the story is about
 * is a door the player is meant to try, and the rest of that kind then compete
 * on what they hold like any other.
 */
export function openDoors(frontages: readonly Frontage[], rng: Rng, town: Town): ReadonlySet<string> {
  if (!frontages.length) return new Set()
  const budget = new DoorBudget({ built: town.built, open: town.open.length }, frontages.length, rng)

  const scored: Ranked[] = frontages.map((frontage, at) => ({
    frontage,
    at,
    score:
      pullOf(frontage.charter) +
      frontage.nearness * 2 +
      (frontage.onAvenue ? SPINE : 0) +
      rng.range(0, NUDGE),
  }))
  // two doors worth exactly the same open in the order they were put up
  scored.sort((a, b) => b.score - a.score || a.at - b.at)

  const open = new Set<string>()
  const already = new Map<Word, number>()
  for (const charter of town.open) already.set(charter.word, (already.get(charter.word) ?? 0) + 1)

  const standing = town.open.map(drawOf)

  for (const [, met] of NEEDS) {
    if (open.size >= budget.spare) break
    if (standing.some(met)) continue
    const best = scored.find((candidate) => !open.has(candidate.frontage.id) && met(drawOf(candidate.frontage.charter)))
    if (!best) continue
    open.add(best.frontage.id)
    // a place bought for one need answers the next one too: a shop with chairs
    // in it is somewhere to sit as well as somewhere to buy something, and a
    // town of six doors cannot spend four of them twice over
    standing.push(drawOf(best.frontage.charter))
    already.set(best.frontage.charter.word, (already.get(best.frontage.charter.word) ?? 0) + 1)
  }

  const homes = homesFor(town.built + frontages.length)
  for (const candidate of scored) {
    if (open.size >= budget.spare || standing.filter((draw) => draw.home).length >= homes) break
    if (open.has(candidate.frontage.id) || !candidate.frontage.charter.residential) continue
    open.add(candidate.frontage.id)
    standing.push(drawOf(candidate.frontage.charter))
    already.set(candidate.frontage.charter.word, (already.get(candidate.frontage.charter.word) ?? 0) + 1)
  }

  for (const candidate of scored) {
    if (open.size >= budget.spare) break
    const word = candidate.frontage.charter.word
    if (!candidate.frontage.storied || open.has(candidate.frontage.id) || already.has(word)) continue
    open.add(candidate.frontage.id)
    already.set(word, 1)
  }

  spread(scored, open, already, budget.spare)
  return open
}

/** One building in the ranking. */
interface Ranked {
  readonly frontage: Frontage
  /** Where it stands in the batch, which is how two equal doors are told apart. */
  readonly at: number
  readonly score: number
}

/**
 * Spends what is left of the allowance over as many kinds of place as the town
 * has, by taking the best door of any kind and charging the town for every door
 * of that kind it already opens.
 *
 * The ranking is walked kind by kind rather than straight down, so the cost of
 * a repeat is paid once per pick against a head per kind and not against the
 * whole town: a city of six thousand buildings picks its doors in the same time
 * a hamlet does.
 */
function spread(scored: readonly Ranked[], open: Set<string>, already: Map<Word, number>, allowance: number): void {
  const queues = new Map<Word, Ranked[]>()
  for (const candidate of scored) {
    if (open.has(candidate.frontage.id)) continue
    const queue = queues.get(candidate.frontage.charter.word)
    if (queue) queue.push(candidate)
    else queues.set(candidate.frontage.charter.word, [candidate])
  }

  const heads = new Map<Word, number>()
  while (open.size < allowance) {
    let best: Ranked | undefined
    let worth = -Infinity
    for (const [kind, queue] of queues) {
      const head = queue[heads.get(kind) ?? 0]
      if (!head) continue
      const score = head.score - Math.min(AGAIN * (already.get(kind) ?? 0), MOST_AGAIN)
      if (score > worth || (score === worth && best !== undefined && head.at < best.at)) {
        best = head
        worth = score
      }
    }
    if (!best) return
    const kind = best.frontage.charter.word
    open.add(best.frontage.id)
    heads.set(kind, (heads.get(kind) ?? 0) + 1)
    already.set(kind, (already.get(kind) ?? 0) + 1)
  }
}
