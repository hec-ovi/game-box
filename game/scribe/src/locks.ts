import type { WorldSummary } from '@gb/forge'

type Place = WorldSummary['places'][number]
type Lock = NonNullable<Place['locks']>[number]

/** A locked door as a quest walks up to it: where it is and what opens it. */
export interface Door {
  readonly doorId: string
  readonly room: string
  readonly placeName: string
  readonly keyItemId?: string | undefined
  readonly keeperNpcId?: string | undefined
  readonly password?: string | undefined
}

/** A screen as a quest sits down at it: what it runs and what opens it. */
export interface Screen {
  readonly machineId: string
  readonly program: string
  readonly locked: boolean
  readonly password?: string | undefined
}

/** A thing on a counter: what it costs and who sells it. */
export interface Counter {
  readonly itemId: string
  readonly value: number
  readonly ownerNpcId: string
}

/**
 * The city's locks, screens and counters, read once off the summary and
 * answered by id.
 *
 * What the harness holds a quest to is in here: a person, a thing or a screen
 * behind a locked door is out of reach until every door between the street and
 * it is open, and a street lock puts the whole place behind it. So every id the
 * summary names is mapped to the doors in its way, and a door is mapped to what
 * opens it, which is what the walk in `reach.ts` reads.
 */
export class CityLocks {
  #doors = new Map<string, Door>()
  #screens = new Map<string, Screen>()
  #counters = new Map<string, Counter>()
  #between = new Map<string, readonly string[]>()
  #names = new Map<string, string>()
  #where = new Map<string, string>()
  #ask = new Map<string, string>()

  constructor(places: readonly Place[]) {
    for (const place of places) this.#read(place)
  }

  door(doorId: string): Door | undefined {
    return this.#doors.get(doorId)
  }

  screen(machineId: string): Screen | undefined {
    return this.#screens.get(machineId)
  }

  counter(itemId: string): Counter | undefined {
    return this.#counters.get(itemId)
  }

  /** The doors between the street and this id, nearest the street first. Empty for anything the player can walk up to. */
  between(id: string): readonly string[] {
    return this.#between.get(id) ?? []
  }

  /** Every key item the locks name, which the summary's stock does not list because it is in a pocket. */
  keyItems(): readonly string[] {
    return [...this.#doors.values()].flatMap((door) => (door.keyItemId ? [door.keyItemId] : []))
  }

  /** What the city calls this person or thing. */
  nameOf(id: string): string | undefined {
    return this.#names.get(id)
  }

  /** The place this id stands in, by its sign. */
  placeOf(id: string): string | undefined {
    return this.#where.get(id)
  }

  /**
   * Somebody standing where this id is whom the player can walk straight up to,
   * which is who a job asks for a code. A place the street door shuts has
   * nobody to ask.
   */
  askAbout(id: string): string | undefined {
    return this.#ask.get(id)
  }

  #read(place: Place): void {
    const locks = place.locks ?? []
    const street = locks.filter((lock) => lock.street).map((lock) => lock.doorId)
    const inner = locks.filter((lock) => !lock.street)
    const guarding = (roomId: string | undefined, itemId?: string): readonly string[] => [
      ...street,
      ...inner
        .filter((lock) => lock.roomId === roomId || (itemId !== undefined && lock.behind.includes(itemId)))
        .map((lock) => lock.doorId),
    ]

    for (const lock of locks) {
      this.#doors.set(lock.doorId, {
        doorId: lock.doorId,
        room: lock.room,
        placeName: place.name,
        keyItemId: lock.keyItemId,
        keeperNpcId: lock.keeperNpcId,
        password: lock.password,
      })
      if (!lock.street) this.#between.set(lock.doorId, street)
    }
    for (const npc of place.npcs) {
      this.#between.set(npc.npcId, guarding(npc.roomId))
      this.#names.set(npc.npcId, npc.name)
    }
    const open = place.npcs.filter((npc) => guarding(npc.roomId).length === 0)
    for (const item of place.items) {
      this.#between.set(item.itemId, guarding(item.roomId, item.itemId))
      this.#names.set(item.itemId, item.name)
      if (item.value !== undefined && item.ownerNpcId !== undefined) {
        this.#counters.set(item.itemId, { itemId: item.itemId, value: item.value, ownerNpcId: item.ownerNpcId })
      }
    }
    for (const machine of place.machines ?? []) {
      this.#screens.set(machine.machineId, {
        machineId: machine.machineId,
        program: machine.program,
        locked: machine.locked,
        password: machine.password,
      })
      this.#between.set(machine.machineId, guarding(machine.roomId))
    }

    const asker = open[0]?.npcId
    for (const id of [...place.npcs.map((npc) => npc.npcId), ...place.items.map((item) => item.itemId), ...locks.map((lock) => lock.doorId), ...(place.machines ?? []).map((machine) => machine.machineId)]) {
      this.#where.set(id, place.name)
      if (asker) this.#ask.set(id, asker)
    }
  }
}

/** Which of a place's locks stands in front of this room, for a prompt to say so. */
export function lockOn(place: Place, roomId: string | undefined, itemId?: string): Lock | undefined {
  return (place.locks ?? []).find(
    (lock) => lock.street || lock.roomId === roomId || (itemId !== undefined && lock.behind.includes(itemId)),
  )
}
