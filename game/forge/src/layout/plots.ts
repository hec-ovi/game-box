import type { Rng } from '@gb/kit'
import type { BuildingKind, Facing, Rect } from '@gb/world'

/** A building-shaped hole in a block, before anything is named or built. */
export interface PlotSite {
  readonly rect: Rect
  readonly facing: Facing
  /** The sidewalk cell you stand on to go in. */
  readonly entrance: { x: number; y: number }
}

const MIN_FRONT = 3
const MAX_FRONT = 6
const MIN_DEPTH = 4
const MAX_DEPTH = 8

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

  // a block too small for a ring becomes one row facing south
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

/** How tall a building of this kind gets, within the brief's limit. */
export function storeysFor(kind: BuildingKind, maxStoreys: number, rng: Rng): number {
  const ranges: Partial<Record<BuildingKind, [number, number]>> = {
    house: [1, 2],
    apartment: [3, maxStoreys],
    office: [2, maxStoreys],
    hotel: [2, maxStoreys],
    warehouse: [1, 2],
    chapel: [1, 2],
  }
  const [low, high] = ranges[kind] ?? [1, 2]
  return Math.max(1, Math.min(maxStoreys, rng.int(low, Math.max(low, Math.min(high, maxStoreys)) + 1)))
}
