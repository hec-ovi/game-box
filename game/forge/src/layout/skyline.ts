import type { Rng } from '@gb/kit'
import { PLOT_BAND, TALLEST_STOREYS } from '@gb/world'

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
 * How tall a building stands is architecture, so it is settled here with the
 * footprint and before anybody has said what the building is. Most of a town is
 * the band the building catalogue is drawn for, one to four storeys, a storey
 * taller on an avenue. Over that band the kit stacks a storey of wall at a
 * time, and that is what a skyline is made of: near the middle of town, and
 * along the avenues that run out of it, plots reach for the whole of the
 * brief's ceiling; a few streets out they reach for a fraction of it; at the
 * edge of town nothing is raised at all.
 *
 * The height is then a fact the writing is handed: a writer told a building is
 * twelve storeys on an avenue writes what stands twelve storeys up, rather than
 * a kind being chosen first and the town built around it.
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
  storeysFor(spot: StoreySpot, rng: Rng): number {
    const built = this.#inBand(spot, rng)
    if (this.#headroom <= 0) return built

    const sky = rng.fork('skyline')
    const reach = this.#reachAt(spot)
    // the low town, and the low buildings a downtown keeps between its towers
    if (!sky.chance(reach ** DOWNTOWN.slope * this.#density)) return built

    // what the town reaches for here, in storeys over the band
    const over = Math.round(this.#headroom * reach)
    if (over < 1) return built
    return this.#band + 1 + Math.floor(sky.float() ** DOWNTOWN.spread * over)
  }

  /** The height a building takes inside the band: a storey taller on an avenue, which is where a town puts its frontage. */
  #inBand(spot: StoreySpot, rng: Rng): number {
    const lift = spot.onAvenue ? 1 : 0
    const floor = Math.min(this.#band, PLOT_BAND.storeys.min + lift)
    return Math.max(1, rng.int(floor, this.#band + 1))
  }

  /** How much of the brief's headroom the town reaches for at a spot: 1 downtown, 0 out in the low town. */
  #reachAt(spot: StoreySpot): number {
    const near = Math.max(0, spot.nearness) + (spot.onAvenue ? DOWNTOWN.spine : 0)
    return smoothstep(DOWNTOWN.edge, DOWNTOWN.core, near)
  }
}

/** 0 under `from`, 1 over `to`, an S between: a field a town has no edge to. */
function smoothstep(from: number, to: number, at: number): number {
  const t = Math.min(1, Math.max(0, (at - from) / (to - from)))
  return t * t * (3 - 2 * t)
}
