import type { Rng } from '@gb/kit'
import { PLOT_BAND, TALLEST_STOREYS, type Charter, type Facing, type Rect } from '@gb/world'

/** A building-shaped hole in a block, before anything is named or built. */
export interface PlotSite {
  readonly rect: Rect
  readonly facing: Facing
  /** The sidewalk cell you stand on to go in. */
  readonly entrance: { x: number; y: number }
}

/**
 * The footprints a plot comes in, read off `@gb/world`'s `PLOT_BAND`: the
 * building art is drawn for exactly those, so every plot cut here is inside it,
 * whatever block size the brief names. Height is the one side of the band a
 * plot may pass, because the kit builds a wall a storey at a time; see
 * `storeysFor`.
 */
const MIN_FRONT = PLOT_BAND.frontage.min
const MAX_FRONT = PLOT_BAND.frontage.max
const MIN_DEPTH = PLOT_BAND.depth.min
const MAX_DEPTH = PLOT_BAND.depth.max

/** How far back from the sidewalk the buildings on a block stand. */
function depthOf(shortSide: number): number {
  return Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, Math.floor(shortSide / 2) - 1))
}

/**
 * Whether a square block this many cells a side gets buildings on its east and
 * west sides too, or only the north and south strips. The north and south
 * strips eat `depth` cells each; what is left in the middle has to be deep
 * enough for a frontage, or those two sides are yard. The street planner picks
 * block sizes that pass this, which is what puts doors on every street.
 */
export function cutsFourWays(cells: number): boolean {
  const depth = depthOf(cells)
  return cells >= depth * 2 + 2 && cells - depth * 2 >= MIN_FRONT
}

/**
 * Turns a block into building sites facing the sidewalk around it: a strip on
 * each side, the middle left as yard. Sites are laid out in whole cells, so the
 * grid stays the source of truth for what is occupied.
 */
export function sitesInBlock(block: Rect, rng: Rng): PlotSite[] {
  const depth = depthOf(Math.min(block.w, block.h))
  const sites: PlotSite[] = []

  // a block too small for a ring becomes one row facing south; every block is
  // at least as deep as the band's shallowest plot, so the row is never shallower
  if (block.h < depth * 2 + 2 || block.w < MIN_FRONT * 2) {
    sites.push(...strip(block, 'south', Math.min(depth, block.h), rng))
    return sites
  }

  const middleHeight = block.h - depth * 2
  sites.push(...strip({ x: block.x, y: block.y, w: block.w, h: depth }, 'north', depth, rng))
  sites.push(...strip({ x: block.x, y: block.y + block.h - depth, w: block.w, h: depth }, 'south', depth, rng))
  if (middleHeight >= MIN_FRONT) {
    sites.push(...strip({ x: block.x, y: block.y + depth, w: depth, h: middleHeight }, 'west', depth, rng))
    sites.push(...strip({ x: block.x + block.w - depth, y: block.y + depth, w: depth, h: middleHeight }, 'east', depth, rng))
  }
  return sites
}

/** Cuts one side of a block into plots of varying frontage. */
function strip(area: Rect, facing: Facing, depth: number, rng: Rng): PlotSite[] {
  const horizontal = facing === 'north' || facing === 'south'
  const along = horizontal ? area.w : area.h
  const sites: PlotSite[] = []

  let offset = 0
  while (along - offset >= MIN_FRONT) {
    const front = Math.min(rng.int(MIN_FRONT, MAX_FRONT + 1), along - offset)
    const rect: Rect = horizontal
      ? { x: area.x + offset, y: area.y, w: front, h: depth }
      : { x: area.x, y: area.y + offset, w: depth, h: front }

    sites.push({ rect, facing, entrance: doorstep(rect, facing) })
    offset += front
  }
  return sites
}

/** The sidewalk cell in front of the door. */
function doorstep(rect: Rect, facing: Facing): { x: number; y: number } {
  const midX = rect.x + Math.floor(rect.w / 2)
  const midY = rect.y + Math.floor(rect.h / 2)
  switch (facing) {
    case 'north':
      return { x: midX, y: rect.y - 1 }
    case 'south':
      return { x: midX, y: rect.y + rect.h }
    case 'west':
      return { x: rect.x - 1, y: midY }
    case 'east':
      return { x: rect.x + rect.w, y: midY }
  }
}

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
 * The skyline: how often a plot is offered the height a brief allows over the
 * band the catalogue is drawn for, and how much of it it takes.
 *
 * A skyline is a few tall things against many low ones, standing where a town
 * puts its height. An even lift is a plateau, which reads as wrong as a town of
 * bungalows, so three things narrow it: a plot on an avenue is offered a tower
 * far more often than one on a back street, the offer fades towards the edge of
 * town so the towers make a downtown rather than a sprinkle, and what a raised
 * plot takes of the headroom comes off a curve that keeps most of them modest.
 */
const SKYLINE = {
  /** Share of the plots that could stack which do, on an avenue in the middle of town at density 1. */
  spine: 0.9,
  /** The same on a side street: a tower off the spine is the exception that makes the spine read. */
  side: 0.26,
  /** The offer is scaled by `nearness ** core`, so height falls away from the middle rather than stopping at a line. */
  core: 1.5,
  /** How far past the band a raised plot goes: `float() ** steep` of the headroom, so four in five clear it by less than half of it. */
  steep: 3,
} as const

/**
 * How tall a building of this kind gets: the charter's own range, within the
 * band the building art is drawn for. A building on an avenue stands a storey
 * taller than the same building on a side street: the spine is where a town
 * puts its frontage.
 *
 * A brief allowing more than the band is asking for towers, and a few plots
 * take it. Which ones is read off the charter's own numbers: a kind that
 * already builds to the top of the band is one that stacks, and a kind that
 * tops out under it is a house or a chapel and stays one, so a kind of place a
 * history invented towers exactly if it said it was tall. The draws come off a
 * stream of their own, so a city built inside the band is the same city it was
 * before there was a skyline at all.
 */
export function storeysFor(charter: Charter, brief: StoreyBrief, rng: Rng, spot: StoreySpot): number {
  const band = Math.min(brief.maxStoreys, PLOT_BAND.storeys.max)
  const [low, high] = charter.size.storeys
  const lift = spot.onAvenue ? 1 : 0
  const floor = Math.min(band, low + lift)
  const ceiling = Math.max(floor, Math.min(high + lift, band))
  const built = Math.max(1, rng.int(floor, ceiling + 1))

  const headroom = Math.min(brief.maxStoreys, TALLEST_STOREYS) - band
  if (headroom <= 0 || high < PLOT_BAND.storeys.max) return built

  const sky = rng.fork('skyline')
  const offer = (spot.onAvenue ? SKYLINE.spine : SKYLINE.side) * brief.density * Math.max(0, spot.nearness) ** SKYLINE.core
  if (!sky.chance(offer)) return built
  // a raised plot clears the band, so every one of them is a building the
  // catalogue has no shape for rather than a shop that happens to be tall
  return band + Math.max(1, Math.round(sky.float() ** SKYLINE.steep * headroom))
}

/** How near the middle of a grid a cell is: 1 in the middle, 0 at the furthest corner. */
export function nearnessIn(size: { readonly width: number; readonly height: number }, cell: { readonly x: number; readonly y: number }): number {
  const middle = { x: size.width / 2, y: size.height / 2 }
  const furthest = Math.hypot(middle.x, middle.y) || 1
  return Math.max(0, 1 - Math.hypot(cell.x - middle.x, cell.y - middle.y) / furthest)
}
