import { METRICS } from '@gb/world'
import type { Solid } from './walk.ts'

/** Somebody standing or walking. */
export interface Standing {
  readonly x: number
  readonly z: number
}

/** Something driving, which is long, so it is not a circle. */
export interface Rolling {
  readonly x: number
  readonly z: number
  /** Radians, 0 pointing down -Z, the way everything else here measures it. */
  readonly heading: number
}

/**
 * How close you can get to somebody before you are standing in them. Tight on
 * purpose: with the player's own radius on top this is still most of a metre,
 * and any more turns a passer-by into a bollard you cannot get round.
 */
export const PERSON_CLEAR = 0.34

/**
 * The walls, plus whoever is in the way. People and cars move every frame, so
 * this is asked fresh rather than baked: the player cannot walk through a crowd
 * or through traffic, which the grid alone knows nothing about.
 */
export function alsoBlockedBy(
  base: Solid,
  people: () => readonly Standing[],
  cars: () => readonly Rolling[] = () => [],
): Solid {
  const halfLength = METRICS.vehicle.carLength / 2
  const halfWidth = METRICS.vehicle.carWidth / 2

  return (x, z) => {
    if (base(x, z)) return true

    for (const person of people()) {
      const dx = x - person.x
      const dz = z - person.z
      if (dx * dx + dz * dz < PERSON_CLEAR * PERSON_CLEAR) return true
    }

    for (const car of cars()) {
      // into the car's own frame, where it is just a rectangle
      const dx = x - car.x
      const dz = z - car.z
      const sin = Math.sin(-car.heading)
      const cos = Math.cos(-car.heading)
      const along = dx * sin + dz * cos
      const across = dx * cos - dz * sin
      if (Math.abs(along) < halfLength && Math.abs(across) < halfWidth) return true
    }
    return false
  }
}
