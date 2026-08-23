import type { Facing, World } from '@gb/world'
import type * as THREE from 'three'

/** Where the player starts, and which way they are looking. */
export interface Standing {
  readonly x: number
  readonly z: number
  /** A three.js yaw in radians, the way the app turns its camera. */
  readonly heading: number
}

/** A step off the doorstep: inside arm's reach of the door, and clear of the wall. */
const STEP_OFF = 2

/** The ground a player may open their eyes on. */
const STANDABLE = new Set(['sidewalk', 'park'])

/** Which way a wall faces, as a unit vector out of the building. */
const AWAY: Record<Facing, { x: number; z: number }> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
  east: { x: 1, z: 0 },
}

/**
 * A step off the first door that opens, looking back at it. Most buildings in a
 * city are shut, so the first door on the street is usually one nobody can go
 * through and the player would start facing a blank wall with nothing to press.
 *
 * The step is taken onto pavement: back off a narrow doorstep is a step into
 * the road, so the way out is along the pavement instead. A city with no
 * pavement at all still gets the plain step back.
 */
export function spawnAt(world: World, doorsteps: ReadonlyMap<string, THREE.Vector3>): Standing {
  const plot = world.plots().find((one) => one.interiorId) ?? world.plots()[0]
  const doorstep = plot ? doorsteps.get(plot.id) : undefined
  if (!plot || !doorstep) return { x: 0, z: 0, heading: 0 }

  const back = AWAY[plot.entrance.facing]
  const along = { x: -back.z, z: back.x }
  const ways = [back, along, { x: -along.x, z: -along.z }]
  const stand = ways.map((way) => step(doorstep, way)).find((spot) => standable(world, spot)) ?? step(doorstep, back)

  return {
    ...stand,
    // look back the way we stepped: three.js cameras look down -z at heading 0
    heading: Math.atan2(stand.x - doorstep.x, stand.z - doorstep.z),
  }
}

function step(from: { x: number; z: number }, way: { x: number; z: number }): { x: number; z: number } {
  return { x: from.x + way.x * STEP_OFF, z: from.z + way.z * STEP_OFF }
}

function standable(world: World, at: { x: number; z: number }): boolean {
  const kind = world.grid.at(Math.floor(at.x / world.cellSize), Math.floor(at.z / world.cellSize))
  return kind !== undefined && STANDABLE.has(kind)
}
