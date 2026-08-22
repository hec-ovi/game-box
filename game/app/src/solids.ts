import type { Interior, World } from '@gb/world'
import { METRICS } from '@gb/world'
import type { Solid } from './walk.ts'

/** Outside: buildings, mountains and water are solid; everything else is walkable. */
export function citySolid(world: World): Solid {
  const size = world.cellSize
  return (x, z) => {
    const kind = world.grid.at(Math.floor(x / size), Math.floor(z / size))
    return kind === undefined || kind === 'building' || kind === 'mountain' || kind === 'water'
  }
}

/**
 * Inside: the shell keeps you in, partition walls keep you out of the next
 * room unless there is a door on that stretch of wall.
 */
export function interiorSolid(interior: Interior): Solid {
  const half = METRICS.building.wallThickness / 2
  const gap = METRICS.building.doorWidth
  const doors = interior.doors.map((door) => door.pos)

  return (x, z) => {
    if (x < half || z < half || x > interior.size.w - half || z > interior.size.h - half) return true

    for (const room of interior.rooms) {
      const { rect } = room
      for (const [along, at, edge] of [
        [x, z, rect.y],
        [x, z, rect.y + rect.h],
      ] as const) {
        if (Math.abs(at - edge) < half && along > rect.x && along < rect.x + rect.w) {
          if (!doors.some((door) => Math.abs(door.y - edge) < 0.35 && Math.abs(door.x - along) < gap)) return true
        }
      }
      for (const [along, at, edge] of [
        [z, x, rect.x],
        [z, x, rect.x + rect.w],
      ] as const) {
        if (Math.abs(at - edge) < half && along > rect.y && along < rect.y + rect.h) {
          if (!doors.some((door) => Math.abs(door.x - edge) < 0.35 && Math.abs(door.y - along) < gap)) return true
        }
      }
    }
    return false
  }
}
