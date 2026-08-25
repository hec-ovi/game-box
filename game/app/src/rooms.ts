import type { Dressing } from '@gb/scene'
import { carryOver } from './seam.ts'

/**
 * The art the city is built with, and the art one room is built with.
 *
 * `@gb/scene` owns the rooms now: it builds one when it is asked for and lets
 * it go once the player has walked away from its building, and it builds every
 * one with the dressing the city was built with. The inside of a building is
 * dressed for that building, so the city is handed this instead, and it stands
 * aside for one interior's own room art while that room is being built. A room
 * is only ever built inside the call that asks for it, which returns before
 * anything else runs, so the aim is never live for anything else.
 */
export class CityArt {
  #city: Dressing
  #room: Dressing | undefined

  /** What the city is built with. */
  readonly seam: Dressing

  constructor(city: Dressing) {
    this.#city = city
    const front = (): Dressing => this.#room ?? this.#city
    const seam: Dressing = {
      building: (plot, size, charter) => front().building(plot, size, charter),
      prop: (prop) => front().prop(prop),
      character: (npc, doing) => front().character(npc, doing),
      pickup: (item) => front().pickup(item),
      ground: (kind) => front().ground(kind),
      surface: (part, size) => front().surface(part, size),
    }
    // only what a room is dressed for stands aside for one. How a building
    // looks from far off, what it throws onto the street, the road paint, the
    // rubbish and everything else the city answers for are the city's, never a
    // room's, and they come over whatever they turn out to be
    this.seam = carryOver(seam, city)
  }

  /** Build one room in its own art. Whatever the build answers comes back. */
  inRoom<T>(art: Dressing | undefined, build: () => T): T {
    this.#room = art
    try {
      return build()
    } finally {
      this.#room = undefined
    }
  }
}
