import type { Rect, World } from '@gb/world'
import type { Brief } from '../brief.ts'

/** Cells across a roadway: two 3 m lanes at 2 m per cell. */
export const STREET_CELLS = 3
/** Cells of sidewalk on each side of a street. */
export const SIDEWALK_CELLS = 1
/** Cells of mountain around the whole map. */
export const MOUNTAIN_CELLS = 4

const BAND = SIDEWALK_CELLS + STREET_CELLS + SIDEWALK_CELLS

export interface StreetPlan {
  /** Inner rectangles left between the streets, where buildings go. */
  readonly blocks: readonly Rect[]
  /** Cell coordinates of every street centreline crossing. */
  readonly crossings: ReadonlyArray<{ x: number; y: number }>
  /** Where the map is measured: the whole grid including mountains. */
  readonly size: { width: number; height: number }
}

export function gridSize(brief: Brief): { width: number; height: number } {
  const span = (blocks: number) => MOUNTAIN_CELLS * 2 + BAND * (blocks + 1) + brief.blockCells * blocks
  return { width: span(brief.blocksX), height: span(brief.blocksY) }
}

/**
 * Lays streets in a grid with a sidewalk on each side, rings the map with
 * mountains, and cuts a road out through them. What is left between the
 * sidewalks are the blocks buildings get placed in.
 */
export function layStreets(world: World, brief: Brief): StreetPlan {
  const { width, height } = gridSize(brief)

  world.paint({ x: 0, y: 0, w: width, h: MOUNTAIN_CELLS }, 'mountain')
  world.paint({ x: 0, y: height - MOUNTAIN_CELLS, w: width, h: MOUNTAIN_CELLS }, 'mountain')
  world.paint({ x: 0, y: 0, w: MOUNTAIN_CELLS, h: height }, 'mountain')
  world.paint({ x: width - MOUNTAIN_CELLS, y: 0, w: MOUNTAIN_CELLS, h: height }, 'mountain')

  const bandStarts = (blocks: number) =>
    Array.from({ length: blocks + 1 }, (_, i) => MOUNTAIN_CELLS + i * (BAND + brief.blockCells))

  const columns = bandStarts(brief.blocksX)
  const rows = bandStarts(brief.blocksY)
  const innerWidth = width - MOUNTAIN_CELLS * 2
  const innerHeight = height - MOUNTAIN_CELLS * 2

  for (const x of columns) {
    world.paint({ x, y: MOUNTAIN_CELLS, w: BAND, h: innerHeight }, 'sidewalk')
    world.paint({ x: x + SIDEWALK_CELLS, y: MOUNTAIN_CELLS, w: STREET_CELLS, h: innerHeight }, 'street')
  }
  for (const y of rows) {
    world.paint({ x: MOUNTAIN_CELLS, y, w: innerWidth, h: BAND }, 'sidewalk')
    world.paint({ x: MOUNTAIN_CELLS, y: y + SIDEWALK_CELLS, w: innerWidth, h: STREET_CELLS }, 'street')
  }
  // crossings are roadway, not sidewalk
  for (const x of columns) {
    for (const y of rows) {
      world.paint({ x: x + SIDEWALK_CELLS, y: y + SIDEWALK_CELLS, w: STREET_CELLS, h: STREET_CELLS }, 'street')
    }
  }

  const blocks: Rect[] = []
  for (let bx = 0; bx < brief.blocksX; bx++) {
    for (let by = 0; by < brief.blocksY; by++) {
      blocks.push({
        x: columns[bx]! + BAND,
        y: rows[by]! + BAND,
        w: brief.blockCells,
        h: brief.blockCells,
      })
    }
  }

  const crossings = columns.flatMap((x) =>
    rows.map((y) => ({ x: x + SIDEWALK_CELLS + Math.floor(STREET_CELLS / 2), y: y + SIDEWALK_CELLS + Math.floor(STREET_CELLS / 2) })),
  )

  cutExits(world, brief, columns, rows, { width, height })
  return { blocks, crossings, size: { width, height } }
}

/** Long roads out through the mountains: the only way in or out of the valley. */
function cutExits(
  world: World,
  brief: Brief,
  columns: readonly number[],
  rows: readonly number[],
  size: { width: number; height: number },
): void {
  const sides = ['south', 'north', 'east', 'west'] as const
  for (let i = 0; i < brief.exits; i++) {
    const side = sides[i % sides.length]!
    if (side === 'south' || side === 'north') {
      const x = (columns[Math.floor(columns.length / 2)] ?? MOUNTAIN_CELLS) + SIDEWALK_CELLS
      const y = side === 'south' ? size.height - MOUNTAIN_CELLS : 0
      world.paint({ x, y, w: STREET_CELLS, h: MOUNTAIN_CELLS }, 'street')
    } else {
      const y = (rows[Math.floor(rows.length / 2)] ?? MOUNTAIN_CELLS) + SIDEWALK_CELLS
      const x = side === 'east' ? size.width - MOUNTAIN_CELLS : 0
      world.paint({ x, y, w: MOUNTAIN_CELLS, h: STREET_CELLS }, 'street')
    }
  }
}
