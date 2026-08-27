import type { Rng } from '@gb/kit'
import { PLOT_BAND, TALLEST_STOREYS, type Charter } from '@gb/world'

/** What a brief says about height: the tallest it allows, and how built up the town is. */
export interface StoreyBrief {
  readonly maxStoreys: number
  readonly density: number
}

/** Where a site stands, as height reads it: on the spine or off it, and how near the middle of town. */
export interface StoreySpot {
  readonly onAvenue: boolean
  /** 1 in the middle of the grid, 0 at the furthest corner. */
  readonly nearness: number
}

/**
 * Where a town puts its height, read off nearness, which is 1 in the middle of
 * the grid and 0 at the furthest corner. A square town spends its ground
 * unevenly across that range: the middle tenth of it is over `core`, about half
 * of it is under `edge`, and the rest is the slope between.
 *
 * So these three numbers are a downtown, a mid-rise ring around it and a low
 * outer town, and the spine pushes the whole field out along the avenues rather
 * than letting the core end as a circle.
 */
const DOWNTOWN = {
  /** Under this nearness a town does not stack at all: the low outer half. */
  edge: 0.5,
  /** Over it a plot reaches for whatever the brief allows. */
  core: 0.78,
  /** What standing on an avenue is worth, in nearness. */
  spine: 0.12,
  /** How steeply the count of raised plots falls off the core: over 1 the ring keeps its towers and loses its infill. */
  slope: 2,
  /** How a raised plot's height is spread under its local top: over 1 the tallest are the fewest. */
  spread: 1.8,
} as const

/**
 * How tall each building in one town stands.
 *
 * Most of a town is the band the building catalogue is drawn for, one to four
 * storeys off the charter's own range. Over that band the kit stacks a storey
 * of wall at a time, and that is what a skyline is made of: near the middle of
 * town, and along the avenues that run out of it, plots reach for the whole of
 * the brief's ceiling; a few streets out they reach for a fraction of it; at
 * the edge of town nothing is raised at all. What a kind reaches for on top of
 * that is its own `size.storeys`, so a chapel is a chapel wherever it stands
 * and an office is a tower only downtown.
 */
export class Skyline {
  /** The tallest the catalogue is drawn for, under this brief's ceiling. */
  readonly #band: number
  /** Storeys this brief allows over the band. */
  readonly #headroom: number
  readonly #density: number

  constructor(brief: StoreyBrief) {
    const ceiling = Math.min(brief.maxStoreys, TALLEST_STOREYS)
    this.#band = Math.min(ceiling, PLOT_BAND.storeys.max)
    this.#headroom = ceiling - this.#band
    this.#density = brief.density
  }

  /**
   * How many storeys one plot builds. The draws that raise it come off a stream
   * of their own, so a brief inside the band builds exactly the city it built
   * before there was a skyline at all, and a plot that is raised always clears
   * the band: it is a building the catalogue has no shape for rather than a
   * shop that happens to be tall.
   */
  storeysFor(charter: Charter, spot: StoreySpot, rng: Rng): number {
    const built = this.#inBand(charter, spot, rng)
    if (this.#headroom <= 0) return built

    const sky = rng.fork('skyline')
    const reach = this.#reachAt(spot)
    // the low town, and the low buildings a downtown keeps between its towers
    if (!sky.chance(reach ** DOWNTOWN.slope * this.#density)) return built

    // what this kind reaches for here, in storeys over the band
    const over = Math.round(this.#headroom * reach * stacksOf(charter))
    if (over < 1) return built
    return this.#band + 1 + Math.floor(sky.float() ** DOWNTOWN.spread * over)
  }

  /** The height a kind builds to on its own, inside the band: a storey taller on an avenue, which is where a town puts its frontage. */
  #inBand(charter: Charter, spot: StoreySpot, rng: Rng): number {
    const [low, high] = charter.size.storeys
    const lift = spot.onAvenue ? 1 : 0
    const floor = Math.min(this.#band, low + lift)
    const ceiling = Math.max(floor, Math.min(high + lift, this.#band))
    return Math.max(1, rng.int(floor, ceiling + 1))
  }

  /** How much of the brief's headroom the town reaches for at a spot: 1 downtown, 0 out in the low town. */
  #reachAt(spot: StoreySpot): number {
    const near = Math.max(0, spot.nearness) + (spot.onAvenue ? DOWNTOWN.spine : 0)
    return smoothstep(DOWNTOWN.edge, DOWNTOWN.core, near)
  }
}

/**
 * How much of the town's height a kind takes, off the charter's own numbers: a
 * kind that builds to the top of the band takes all of it, one that tops out
 * lower takes that share of it, and a single storey kind takes none. So a kind
 * of place a history invented stands exactly as tall as it said it was, and no
 * word is read.
 */
function stacksOf(charter: Charter): number {
  const reached = charter.size.storeys[1] - PLOT_BAND.storeys.min
  const band = PLOT_BAND.storeys.max - PLOT_BAND.storeys.min
  return Math.min(1, Math.max(0, reached / band))
}

/** 0 under `from`, 1 over `to`, an S between: a field a town has no edge to. */
function smoothstep(from: number, to: number, at: number): number {
  const t = Math.min(1, Math.max(0, (at - from) / (to - from)))
  return t * t * (3 - 2 * t)
}
