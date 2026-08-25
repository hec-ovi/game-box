import type { Rng } from '@gb/kit'
import type { PlotSite } from './plots.ts'

/**
 * Metres of town between one station and the next: about ten blocks, which is
 * a walk of six minutes at the far end of it. Where fast travel boards is a
 * distance, so a city has a handful of entrances however many plots it holds
 * and a town smaller than half that spacing has none.
 */
const SPACING = 500

/** How many stations a town this many metres across has, whatever the mix rolls. */
export function stationsWanted(span: number): number {
  return Math.round(span / SPACING)
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
