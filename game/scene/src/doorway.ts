import { METRICS, type Interior } from '@gb/world'
import type { PropFootprint } from './footprint.ts'

/** How wide a hole a door needs in a wall: the leaf plus a little either side. */
export const DOOR_GAP = METRICS.building.doorWidth + 0.2

/**
 * The floor a player has to keep to walk through the doors. One square per
 * door, as wide as the hole cut in the wall and as deep, so the square covers
 * standing in the opening and stepping out of it either way.
 */
export class Doorways {
  readonly #doors: Interior['doors']

  constructor(doors: Interior['doors']) {
    this.#doors = doors
  }

  /** Would this piece of furniture stand in someone's way out? */
  blockedBy(footprint: PropFootprint): boolean {
    return this.#doors.some((door) => footprint.reaches(door.pos.x, door.pos.y, DOOR_GAP / 2))
  }
}
