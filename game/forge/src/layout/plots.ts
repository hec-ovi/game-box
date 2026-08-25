import type { Rng } from '@gb/kit'
import { PLOT_BAND, type Charter, type Facing, type Rect } from '@gb/world'

/** A building-shaped hole in a block, before anything is named or built. */
export interface PlotSite {
  readonly rect: Rect
  readonly facing: Facing
  /** The sidewalk cell you stand on to go in. */
  readonly entrance: { x: number; y: number }
}

/**
 * The shapes a plot comes in, read off `@gb/world`'s `PLOT_BAND`: the building
 * art is drawn for exactly those, so every plot cut here is inside it, whatever
 * block size the brief names.
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

/**
 * How tall a building of this kind gets: the charter's own range, within the
 * brief's limit and the band's. A building on an avenue stands a storey taller
 * than the same building on a side street: the spine is where a town puts its
 * frontage.
 */
export function storeysFor(charter: Charter, briefStoreys: number, rng: Rng, onAvenue = false): number {
  const maxStoreys = Math.min(briefStoreys, PLOT_BAND.storeys.max)
  const [low, high] = charter.size.storeys
  const lift = onAvenue ? 1 : 0
  const floor = Math.min(maxStoreys, low + lift)
  const ceiling = Math.max(floor, Math.min(high + lift, maxStoreys))
  return Math.max(1, rng.int(floor, ceiling + 1))
}
