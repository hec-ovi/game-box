import type { Access, Interior, World } from '@gb/world'

type Door = Interior['doors'][number]

/** Where something in the city is: the interior and the room, or nowhere the harness can name. */
interface Spot {
  readonly interiorId: string
  readonly roomId: string
}

/** What one line on the board points at, as a place in the city. */
export type Target = { npcId: string } | { itemId: string } | { interiorId: string; anchorId: string } | { machineId: string } | { doorId: string }

/**
 * The city as a player finds it: what belongs to somebody, what a counter
 * charges, what a key opens, and which doors stand between the street and
 * anything a line on the board names. Read off the world file once; the
 * player's own progress through the locks is the player's.
 */
export class City {
  readonly #world: World
  readonly #doors = new Map<string, Door & { interiorId: string }>()
  /** Per interior, per room, the doors from the street door to that room, in order. */
  readonly #ways = new Map<string, Map<string, string[]>>()

  constructor(world: World) {
    this.#world = world
    for (const interior of world.interiors()) {
      for (const door of interior.doors) this.#doors.set(door.id, { ...door, interiorId: interior.id })
      this.#ways.set(interior.id, waysThrough(interior))
    }
  }

  /** Whether taking this is a theft. */
  owned(itemId: string): boolean {
    return this.#world.item(itemId)?.ownerNpcId !== undefined
  }

  /** What the counter charges for it: zero for a thing nobody sells. */
  price(itemId: string): number {
    return this.#world.item(itemId)?.value ?? 0
  }

  /** What a key or a card in hand opens. */
  opens(itemId: string): Access | undefined {
    return this.#world.item(itemId)?.opens
  }

  door(doorId: string): (Door & { interiorId: string }) | undefined {
    return this.#doors.get(doorId)
  }

  machine(machineId: string): { interiorId: string; machine: NonNullable<Interior['furniture'][number]['machine']> } | undefined {
    const site = this.#world.machine(machineId)
    return site?.furniture.machine ? { interiorId: site.interiorId, machine: site.furniture.machine } : undefined
  }

  /** The doors between the street and what a line names, street door first. Nothing for something out on the street. */
  wayTo(target: Target): readonly string[] {
    if ('doorId' in target) {
      const door = this.#doors.get(target.doorId)
      if (!door || door.from === 'outside') return []
      return this.#ways.get(door.interiorId)?.get(door.from) ?? []
    }
    const spot = this.#spotOf(target)
    return spot ? (this.#ways.get(spot.interiorId)?.get(spot.roomId) ?? []) : []
  }

  #spotOf(target: Exclude<Target, { doorId: string }>): Spot | undefined {
    if ('npcId' in target) {
      const station = this.#world.npc(target.npcId)?.station
      return station ? this.#anchorSpot(station.interiorId, station.anchorId) : undefined
    }
    if ('machineId' in target) {
      const site = this.#world.machine(target.machineId)
      return site ? { interiorId: site.interiorId, roomId: site.furniture.roomId } : undefined
    }
    if ('anchorId' in target) return this.#anchorSpot(target.interiorId, target.anchorId)
    const placement = this.#world.placements().find((one) => one.itemId === target.itemId)
    if (!placement) return undefined
    if (placement.at === 'anchor') return this.#anchorSpot(placement.interiorId, placement.anchorId)
    return placement.at === 'npc' ? this.#spotOf({ npcId: placement.npcId }) : undefined
  }

  #anchorSpot(interiorId: string, anchorId: string): Spot | undefined {
    const roomId = this.#world.interior(interiorId)?.anchors.find((anchor) => anchor.id === anchorId)?.roomId
    return roomId ? { interiorId, roomId } : undefined
  }
}

/** The doors on the way from the street to every room of one interior. */
function waysThrough(interior: Interior): Map<string, string[]> {
  const ways = new Map<string, string[]>()
  const street = interior.doors.find((door) => door.from === 'outside')
  if (!street) return ways
  ways.set(street.to, [street.id])
  const queue = [street.to]
  while (queue.length) {
    const room = queue.shift()!
    for (const door of interior.doors) {
      if (door.from !== room || ways.has(door.to)) continue
      ways.set(door.to, [...ways.get(room)!, door.id])
      queue.push(door.to)
    }
  }
  return ways
}
