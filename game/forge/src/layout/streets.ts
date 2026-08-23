import type { World } from '@gb/world'
import { BAND, MOUNTAIN_CELLS, SIDEWALK_CELLS, STREET_CELLS } from './bands.ts'
import { paintExit } from './exits.ts'
import type { StreetPlan } from './plan.ts'

/**
 * Paints a planned town onto the grid: the mountain ring, then every pavement,
 * then every roadway on top of it, then the roads out and the open squares.
 *
 * The order is the whole point. Bands cross each other, and whatever is painted
 * last wins the cells they share. Pavement first and roadway second leaves a
 * junction shaped like a junction: roadway all the way through in both
 * directions, with a corner of pavement in each quarter. Painting a whole band
 * at a time and then patching the crossings back is what put 15 cm of kerb
 * across the middle of every north-south street.
 */
export function paintStreets(world: World, plan: StreetPlan): void {
  const { width, height } = plan.size
  const innerWidth = width - MOUNTAIN_CELLS * 2
  const innerHeight = height - MOUNTAIN_CELLS * 2

  world.paint({ x: 0, y: 0, w: width, h: MOUNTAIN_CELLS }, 'mountain')
  world.paint({ x: 0, y: height - MOUNTAIN_CELLS, w: width, h: MOUNTAIN_CELLS }, 'mountain')
  world.paint({ x: 0, y: 0, w: MOUNTAIN_CELLS, h: height }, 'mountain')
  world.paint({ x: width - MOUNTAIN_CELLS, y: 0, w: MOUNTAIN_CELLS, h: height }, 'mountain')

  for (const x of plan.columns) world.paint({ x, y: MOUNTAIN_CELLS, w: BAND, h: innerHeight }, 'sidewalk')
  for (const y of plan.rows) world.paint({ x: MOUNTAIN_CELLS, y, w: innerWidth, h: BAND }, 'sidewalk')
  for (const x of plan.columns) world.paint({ x: x + SIDEWALK_CELLS, y: MOUNTAIN_CELLS, w: STREET_CELLS, h: innerHeight }, 'street')
  for (const y of plan.rows) world.paint({ x: MOUNTAIN_CELLS, y: y + SIDEWALK_CELLS, w: innerWidth, h: STREET_CELLS }, 'street')

  for (const exit of plan.exits) paintExit(world, exit)
  for (const square of plan.open) world.paint(square.rect, square.kind === 'park' ? 'park' : 'sidewalk')
}
