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

/** How far off a doorstep a car of the player's is looked for, in metres. */
const KERB_REACH = 8

/**
 * On the pavement at a door that opens, looking at it. Most buildings in a city
 * are shut, so the first door on the street is usually one nobody can go
 * through: the player would open facing a blank wall with nothing to press.
 * With no open door anywhere, the city's own spawn stands.
 */
export function atAnOpenDoor(world: World, city: CityBuild): Standing {
  for (const plot of world.plots()) {
    const doorstep = plot.interiorId ? city.doorsteps.get(plot.id) : undefined
    if (doorstep) return offTheDoorstep(world, plot, doorstep)
  }
  return city.spawn
}

/**
 * A step off a doorstep, looking back at the door. Only ever onto pavement: a
 * step back off a narrow one is a step into the road, so the way out is along
 * the pavement instead, and a doorstep with no pavement round it is stood on.
 */
export function offTheDoorstep(world: World, plot: Plot, doorstep: { x: number; z: number }): Standing {
  const inward = towardsTheDoor(world, plot, doorstep)
  const along = { x: -inward.z, z: inward.x }
  const stand = [step(doorstep, inward, -1), step(doorstep, along, 1), step(doorstep, along, -1)].find((spot) =>
    onThePavement(world, spot),
  )
  if (!stand) return { x: doorstep.x, z: doorstep.z, heading: Math.atan2(-inward.x, -inward.z) }
  return { x: stand.x, z: stand.z, heading: Math.atan2(stand.x - doorstep.x, stand.z - doorstep.z) }
}

/**
 * Where a car of the player's stands outside a building of theirs: the road
 * out from its door, so it is on tarmac and not across the way in. A door with
 * no road within reach parks it on the doorstep, which is the only ground
 * anybody knows is there.
 */
export function atTheKerb(world: World, city: CityBuild, plotId: string): { x: number; z: number } | undefined {
  const plot = world.plot(plotId)
  const doorstep = city.doorsteps.get(plotId)
  if (!plot || !doorstep) return undefined

  const inward = towardsTheDoor(world, plot, doorstep)
  for (let away = 2; away <= KERB_REACH; away += 1) {
    const spot = { x: doorstep.x - inward.x * away, z: doorstep.z - inward.z * away }
    if (world.grid.at(Math.floor(spot.x / world.cellSize), Math.floor(spot.z / world.cellSize)) === 'street') return spot
  }
  return doorstep
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
