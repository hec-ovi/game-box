import type { CityBuild } from '@gb/scene'
import type { Plot, World } from '@gb/world'

/** Where the player starts, and which way they are looking. */
export interface Standing {
  readonly x: number
  readonly z: number
  readonly heading: number
}

/**
 * How far off the doorstep the player opens their eyes. Inside the reach, so
 * the way in is offered from the first frame, and far enough off that the front
 * of the building reads as a building rather than as a wall of render.
 */
const BACK_OFF = 2

/**
 * On the pavement at a door that opens, looking at it. Most buildings in a city
 * are shut, so the first door on the street is usually one nobody can go
 * through: the player would open facing a blank wall with nothing to press.
 * With no open door anywhere, the city's own spawn stands.
 */
export function atAnOpenDoor(world: World, city: CityBuild): Standing {
  for (const plot of world.plots()) {
    const doorstep = plot.interiorId ? city.doorsteps.get(plot.id) : undefined
    if (!doorstep) continue

    const inward = towardsTheDoor(world, plot, doorstep)
    const along = { x: -inward.z, z: inward.x }
    // a step off the doorstep, and only ever onto pavement: a step back off a
    // narrow one is a step into the road, so the way out is along it instead
    const stand = [step(doorstep, inward, -1), step(doorstep, along, 1), step(doorstep, along, -1)].find((spot) =>
      onThePavement(world, spot),
    )
    if (!stand) return { x: doorstep.x, z: doorstep.z, heading: Math.atan2(-inward.x, -inward.z) }
    return { x: stand.x, z: stand.z, heading: Math.atan2(stand.x - doorstep.x, stand.z - doorstep.z) }
  }
  return city.spawn
}

function step(from: { x: number; z: number }, way: { x: number; z: number }, sign: number): { x: number; z: number } {
  return { x: from.x + way.x * BACK_OFF * sign, z: from.z + way.z * BACK_OFF * sign }
}

/** The way from the doorstep into the building, as a unit vector. */
function towardsTheDoor(world: World, plot: Plot, doorstep: { x: number; z: number }): { x: number; z: number } {
  const size = world.cellSize
  const x = (plot.rect.x + plot.rect.w / 2) * size - doorstep.x
  const z = (plot.rect.y + plot.rect.h / 2) * size - doorstep.z
  const away = Math.hypot(x, z) || 1
  return { x: x / away, z: z / away }
}

function onThePavement(world: World, at: { x: number; z: number }): boolean {
  const kind = world.grid.at(Math.floor(at.x / world.cellSize), Math.floor(at.z / world.cellSize))
  return kind === 'sidewalk' || kind === 'park'
}
