import type { PropFootprint } from '@gb/scene'
import type { Interior, World } from '@gb/world'
import { footprintOf, METRICS } from '@gb/world'
import type { Solid } from './walk.ts'

/** The little the city needs to know about the land it stands on. */
export interface Ground {
  heightAt(x: number, z: number): number
  walkableAt(x: number, z: number): boolean
}

/**
 * How high the ground is under a point outside. The pavement stands a kerb
 * above the road, so walking onto it is a step up rather than a clip through.
 * Past the built area the land answers, which is what lets the player walk out
 * of town onto open country instead of into an invisible wall.
 */
export function cityGround(world: World, land?: Ground): (x: number, z: number) => number {
  const size = world.cellSize
  return (x, z) => {
    const kind = world.grid.at(Math.floor(x / size), Math.floor(z / size))
    if (kind === 'sidewalk' || kind === 'park') return METRICS.street.curbHeight
    return land?.heightAt(x, z) ?? 0
  }
}

/**
 * Outside: buildings and water stop you, and beyond the built area the land
 * decides, so a cliff or a pond stops you and a hillside does not. With no land
 * given, the edge of the grid is the edge of the world.
 */
export function citySolid(world: World, land?: Ground): Solid {
  const size = world.cellSize
  return (x, z) => {
    const kind = world.grid.at(Math.floor(x / size), Math.floor(z / size))
    if (kind === undefined) return land ? !land.walkableAt(x, z) : true
    return kind === 'building' || kind === 'water'
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

/**
 * Inside, with the furniture in the way. The shell and the partitions come from
 * the room plan; the furniture comes from the shapes actually drawn, so what
 * stops you is exactly what you can see. A point test, because the body's own
 * width is added by `blocked` sampling around it.
 */
export function furnishedSolid(interior: Interior, blockers: readonly PropFootprint[]): Solid {
  const shell = interiorSolid(interior)
  if (blockers.length === 0) return shell
  return (x, z) => shell(x, z) || blockers.some((footprint) => footprint.contains(x, z))
}

/**
 * The gate of bars across a locked door. `@gb/world` says how much floor the
 * gate stands on and where the piece is; whether it stops you is the lock,
 * asked fresh, so a door unlocked in the middle of a room is walked through
 * without the room being rebuilt. A room with no gate in it costs nothing.
 */
export function gated(base: Solid, interior: Interior, locked: (doorId: string) => boolean): Solid {
  const size = footprintOf('bars-door')
  const gates = interior.furniture.flatMap((piece) =>
    piece.prop === 'bars-door' && piece.doorId !== undefined
      ? [{ doorId: piece.doorId, x: piece.pos.x, z: piece.pos.y, turn: (piece.rot * Math.PI) / 180 }]
      : [],
  )
  if (gates.length === 0) return base

  return (x, z) => {
    if (base(x, z)) return true
    for (const gate of gates) {
      if (!locked(gate.doorId)) continue
      const dx = x - gate.x
      const dz = z - gate.z
      const sin = Math.sin(-gate.turn)
      const cos = Math.cos(-gate.turn)
      if (Math.abs(dx * cos - dz * sin) < size.width / 2 && Math.abs(dx * sin + dz * cos) < size.depth / 2) return true
    }
    return false
  }
}
