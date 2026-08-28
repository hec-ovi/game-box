import type { Rng } from '@gb/kit'
import type { PlotSite } from './plots.ts'

/**
 * Metres of town between one station and the next: about ten blocks, which is
 * a walk of six minutes at the far end of it. Where fast travel boards is a
 * distance, so a city has a handful of entrances however many plots it holds
 * and a town smaller than half that spacing has none.
 */
const SPACING = 500

/**
 * The fewest entrances a town that boards at all has. A ride goes from one
 * entrance to another, so a town with a single station is a travel panel with
 * nowhere to go: it boards nowhere, or it boards somewhere worth riding to.
 */
const FEWEST = 2

/**
 * How many stations a town this many metres across has, whatever the mix rolls.
 *
 * `demanded` is how many the town's own history already put up. A history that
 * says the town has a station is honoured wherever the spacing would ask for
 * none, and the town then gets a second, because the first only means anything
 * once there is somewhere to ride to.
 */
export function stationsWanted(span: number, demanded: number): number {
  const spaced = Math.round(span / SPACING)
  if (!spaced && !demanded) return 0
  return Math.max(spaced, demanded, FEWEST)
}

/** What a town's stations are picked from, and where it already boards. */
export interface Spread {
  /** Every site the plan cut, in plan order. */
  readonly sites: readonly PlotSite[]
  /** Stations the town has in all, the standing ones counted. */
  readonly count: number
  /** Sites already spoken for, which no station may take. */
  readonly taken: ReadonlySet<number>
  /** Sites already boarding: the station a history demanded, put up with the staples. */
  readonly standing: readonly number[]
  /** The town's own stations stream, which the first entrance comes off. */
  readonly rng: Rng
}

/**
 * The sites to put the rest of a town's stations on: each the free site
 * furthest from every one already boarding, so two entrances are never on the
 * same corner and a town's are a walk apart. With nothing boarding yet the
 * first one comes off the seed.
 */
export function spreadSites({ sites, count, taken, standing, rng }: Spread): number[] {
  const free = sites.map((_, index) => index).filter((index) => !taken.has(index))
  const wanted = Math.min(count - standing.length, free.length)
  if (wanted <= 0) return []
  const boarding = [...standing]
  const added: number[] = []
  while (added.length < wanted) {
    const next = boarding.length ? furthest(sites, free, boarding) : rng.pick(free)
    boarding.push(next)
    added.push(next)
  }
  return added
}

/** The free site furthest from every station already boarding. */
function furthest(sites: readonly PlotSite[], free: readonly number[], boarding: readonly number[]): number {
  let best = free[0]!
  let apart = -1
  for (const index of free) {
    if (boarding.includes(index)) continue
    const near = Math.min(...boarding.map((other) => distance(sites[index]!, sites[other]!)))
    if (near > apart) {
      apart = near
      best = index
    }
  }
  return best
}

const distance = (a: PlotSite, b: PlotSite): number => Math.hypot(a.entrance.x - b.entrance.x, a.entrance.y - b.entrance.y)
