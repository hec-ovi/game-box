import type { Access, World } from '@gb/world'

/**
 * The locks of the city as this box reads them: what a key or card in the
 * file opens, from either side the file wrote it on, and where an access
 * leads, named the way the town names the building.
 */
export class Locks {
  #world: World

  constructor(world: World) {
    this.#world = world
  }

  /** What a thing opens: its own `opens`, else the door that names it as its key. Nothing for a thing that opens nothing. */
  opensWith(itemId: string): Access | undefined {
    const own = this.#world.item(itemId)?.opens
    if (own) return own
    for (const interior of this.#world.interiors()) {
      const door = interior.doors.find((candidate) => candidate.keyItemId === itemId)
      if (door) return { doorId: door.id }
    }
    return undefined
  }

  /** The building an access leads into, by name. Nothing when the city has no such door. */
  placeOf(access: Access): string | undefined {
    const interiorId = 'interiorId' in access ? access.interiorId : this.#world.door(access.doorId)?.interiorId
    const interior = interiorId ? this.#world.interior(interiorId) : undefined
    return interior && this.#world.plot(interior.plotId)?.name
  }
}
