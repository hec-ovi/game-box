import type { CityBuild } from '@gb/scene'
import type { World } from '@gb/world'
import type { Vec2 } from './walk.ts'

/** A door on the street: where its doorstep is, and what the building is called. */
export interface StreetDoor {
  readonly plotId: string
  readonly name: string
  readonly x: number
  readonly z: number
}

/**
 * The doors on the street, held as one flat list so the ones within arm's reach
 * are found by arithmetic rather than by walking the town. Every frame asks
 * what the player could open, and a 50 block city has 16,809 plots: read off
 * the world and the doorsteps each time, that question alone was 2.2 ms a frame.
 *
 * The list is taken from the city's own doorsteps and taken again whenever the
 * city gains one, so a door that opens where a facade was painted joins it.
 */
export class StreetDoors {
  #world: World
  #city: CityBuild
  #doors: StreetDoor[] = []
  #counted = -1
  /** Answered into the same array every call: the caller reads it and keeps nothing. */
  #within: StreetDoor[] = []

  constructor(world: World, city: CityBuild) {
    this.#world = world
    this.#city = city
  }

  /** The doors within `range` metres of a point. */
  near(at: Vec2, range: number): readonly StreetDoor[] {
    this.#read()
    const reach = range * range
    let used = 0
    for (const door of this.#doors) {
      const dx = door.x - at.x
      const dz = door.z - at.z
      if (dx * dx + dz * dz > reach) continue
      this.#within[used++] = door
    }
    this.#within.length = used
    return this.#within
  }

  #read(): void {
    if (this.#city.doorsteps.size === this.#counted) return
    this.#counted = this.#city.doorsteps.size
    this.#doors = []
    for (const plot of this.#world.plots()) {
      const doorstep = this.#city.doorsteps.get(plot.id)
      if (!doorstep || !plot.interiorId) continue
      this.#doors.push({ plotId: plot.id, name: plot.name, x: doorstep.x, z: doorstep.z })
    }
  }
}
