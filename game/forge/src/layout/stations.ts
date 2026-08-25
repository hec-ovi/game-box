import type { Rng } from '@gb/kit'
import type { PlotSite } from './plots.ts'

/** A town this many blocks or bigger has somewhere to board. */
const FIRST_AT = 4

/** And one more station for every this many blocks on top. */
const PER_STATION = 20

/** How many stations a town of this many blocks has, whatever the mix rolls. */
export function stationsWanted(blocks: number): number {
  return blocks < FIRST_AT ? 0 : 1 + Math.floor(blocks / PER_STATION)
}

/**
 * Sites spread across the town: the first drawn from the seed, each next one
 * the site furthest from every one already picked, so two stations are never
 * on the same corner and a city's are a walk apart.
 */
export function spreadSites(sites: readonly PlotSite[], count: number, taken: ReadonlySet<number>, rng: Rng): number[] {
  const free = sites.map((_, index) => index).filter((index) => !taken.has(index))
  if (!count || !free.length) return []
  const picked = [rng.pick(free)]
  while (picked.length < Math.min(count, free.length)) {
    let best = -1
    let apart = -1
    for (const index of free) {
      if (picked.includes(index)) continue
      const near = Math.min(...picked.map((other) => distance(sites[index]!, sites[other]!)))
      if (near > apart) {
        apart = near
        best = index
      }
    }
    picked.push(best)
  }
  return picked
}

const distance = (a: PlotSite, b: PlotSite): number => Math.hypot(a.entrance.x - b.entrance.x, a.entrance.y - b.entrance.y)
