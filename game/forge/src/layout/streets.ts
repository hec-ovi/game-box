import type { Rect, World } from '@gb/world'
import type { Brief } from '../brief.ts'
import { BAND, CENTRELINE, MOUNTAIN_CELLS, SIDEWALK_CELLS, STREET_CELLS, bandStarts, gridSize, type Cell, type Size } from './bands.ts'
import { paintExit, planExits, type ExitRoad } from './exits.ts'

export interface StreetPlan {
  /** Inner rectangles left between the streets, where buildings go. */
  readonly blocks: readonly Rect[]
  /** Cell coordinates of every street centreline crossing. */
  readonly crossings: readonly Cell[]
  /** The roads out through the mountains: the only ways in or out of the valley. */
  readonly exits: readonly ExitRoad[]
  /** Where the map is measured: the whole grid including mountains. */
  readonly size: Size
}

/**
 * Lays streets in a grid with a sidewalk on each side, rings the map with
 * mountains, and runs a road out through them from one of the crossings. What
 * is left between the sidewalks are the blocks buildings get placed in.
 */
export function layStreets(world: World, brief: Brief): StreetPlan {
  const { width, height } = gridSize(brief)

  world.paint({ x: 0, y: 0, w: width, h: MOUNTAIN_CELLS }, 'mountain')
  world.paint({ x: 0, y: height - MOUNTAIN_CELLS, w: width, h: MOUNTAIN_CELLS }, 'mountain')
  world.paint({ x: 0, y: 0, w: MOUNTAIN_CELLS, h: height }, 'mountain')
  world.paint({ x: width - MOUNTAIN_CELLS, y: 0, w: MOUNTAIN_CELLS, h: height }, 'mountain')

  const columns = bandStarts(brief.blocksX, brief.blockCells)
  const rows = bandStarts(brief.blocksY, brief.blockCells)
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

  const crossings = columns.flatMap((x) => rows.map((y) => ({ x: x + CENTRELINE, y: y + CENTRELINE })))

  const exits = planExits(brief.exits, columns, rows, { width, height })
  for (const exit of exits) paintExit(world, exit)

  return { blocks, crossings, exits, size: { width, height } }
}
