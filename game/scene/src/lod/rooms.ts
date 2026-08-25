import type { World } from '@gb/world'
import type { Dressing } from '../dressing.ts'
import { buildInterior, type InteriorBuild } from '../interior.ts'
import { isNear, type Cell } from './near.ts'

/**
 * The rooms of the city, built on first entry and kept while the player is
 * near. A room whose building is beyond the radius from the player's cell is
 * let go of, geometry and all, and built again from the world file on the
 * next entry, so the city never holds every room at once.
 */
export class CityRooms {
  readonly #world: World
  readonly #dressing: Dressing
  readonly #radius: number
  readonly #held = new Map<string, InteriorBuild>()

  constructor(world: World, dressing: Dressing, radius: number) {
    this.#world = world
    this.#dressing = dressing
    this.#radius = radius
  }

  /** That interior, built now if this is the first entry since it was last let go. Nothing for an id the world lacks. */
  enter(interiorId: string): InteriorBuild | undefined {
    const held = this.#held.get(interiorId)
    if (held) return held
    const interior = this.#world.interior(interiorId)
    if (!interior) return undefined
    const built = buildInterior(this.#world, interior, this.#dressing)
    this.#held.set(interiorId, built)
    return built
  }

  /** The interiors standing built right now, by id. */
  get built(): ReadonlySet<string> {
    return new Set(this.#held.keys())
  }

  /** Lets go of every room whose building is far from that cell. */
  follow(cell: Cell): void {
    for (const [interiorId, room] of this.#held) {
      const interior = this.#world.interior(interiorId)
      const plot = interior && this.#world.plot(interior.plotId)
      if (plot && isNear(plot, cell, this.#radius, this.#world.cellSize)) continue
      room.dispose()
      this.#held.delete(interiorId)
    }
  }
}
