import type { World } from '@gb/world'

const OUTSIDE = 'outside'

interface Doorway {
  readonly id: string
  readonly from: string
  readonly to: string
}

/**
 * The rooms of every interior joined by their doors, with a lock cutting the
 * edge it stands on. The file's `locked` is where each door starts; play
 * moves it with `setLocked` as the player gets past one.
 */
export class DoorGraph {
  readonly #doors = new Map<string, Doorway[]>()
  readonly #locked = new Map<string, boolean>()

  constructor(world: World) {
    for (const interior of world.interiors()) {
      this.#doors.set(interior.id, interior.doors.map(({ id, from, to }) => ({ id, from, to })))
      for (const door of interior.doors) this.#locked.set(door.id, door.locked)
    }
  }

  /** Whether the door is locked; undefined for a door the city does not have. */
  locked(doorId: string): boolean | undefined {
    return this.#locked.get(doorId)
  }

  /** Locks or unlocks a door. An unknown id is ignored. */
  setLocked(doorId: string, locked: boolean): void {
    if (this.#locked.has(doorId)) this.#locked.set(doorId, locked)
  }

  /** Can a room be walked into from the street through unlocked doors only? */
  opens(interiorId: string, roomId: string): boolean {
    const doors = this.#doors.get(interiorId)
    if (!doors) return false
    const seen = new Set<string>([OUTSIDE])
    const frontier = [OUTSIDE]
    while (frontier.length > 0) {
      const room = frontier.pop()!
      if (room === roomId) return true
      for (const door of doors) {
        if (this.#locked.get(door.id)) continue
        const other = door.from === room ? door.to : door.to === room ? door.from : undefined
        if (other !== undefined && !seen.has(other)) {
          seen.add(other)
          frontier.push(other)
        }
      }
    }
    return false
  }
}
