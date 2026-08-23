import type { World } from '@gb/world'
import { BANDS, MOUNTAIN_CELLS, type StreetLine } from './bands.ts'
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
 *
 * A band is as wide as its own class of road, so an avenue is painted 22 m
 * across where the street beside it is 18 m, and the two still meet in a
 * junction that is roadway all the way through.
 */
export function paintStreets(world: World, plan: StreetPlan): void {
  const { width, height } = plan.size
  const innerWidth = width - MOUNTAIN_CELLS * 2
  const innerHeight = height - MOUNTAIN_CELLS * 2

  world.paint({ x: 0, y: 0, w: width, h: MOUNTAIN_CELLS }, 'mountain')
  world.paint({ x: 0, y: height - MOUNTAIN_CELLS, w: width, h: MOUNTAIN_CELLS }, 'mountain')
  world.paint({ x: 0, y: 0, w: MOUNTAIN_CELLS, h: height }, 'mountain')
  world.paint({ x: width - MOUNTAIN_CELLS, y: 0, w: MOUNTAIN_CELLS, h: height }, 'mountain')

  const roadwayOf = (line: StreetLine) => ({ at: line.start + BANDS[line.kind].pavement, cells: BANDS[line.kind].roadway })

  for (const line of plan.columns) world.paint({ x: line.start, y: MOUNTAIN_CELLS, w: line.width, h: innerHeight }, 'sidewalk')
  for (const line of plan.rows) world.paint({ x: MOUNTAIN_CELLS, y: line.start, w: innerWidth, h: line.width }, 'sidewalk')
  for (const line of plan.columns) {
    const road = roadwayOf(line)
    world.paint({ x: road.at, y: MOUNTAIN_CELLS, w: road.cells, h: innerHeight }, 'street')
  }
  for (const line of plan.rows) {
    const road = roadwayOf(line)
    world.paint({ x: MOUNTAIN_CELLS, y: road.at, w: innerWidth, h: road.cells }, 'street')
  }

  for (const exit of plan.exits) paintExit(world, exit)
  for (const square of plan.open) world.paint(square.rect, square.kind === 'park' ? 'park' : 'sidewalk')
}
