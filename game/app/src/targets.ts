import type { Driving } from '@gb/drive'
import type { CityBuild } from '@gb/scene'
import { METRICS, type World } from '@gb/world'
import type { Buildings } from './buildings.ts'
import { StreetDoors } from './doors.ts'
import type { Locks } from './locks.ts'
import type { Machines } from './machines.ts'
import type { Stashing } from './stashing.ts'
import type { Street } from './street.ts'
import type { Travel } from './travel.ts'
import type { Vec2 } from './walk.ts'

export type TargetKind = 'enter' | 'leave' | 'talk' | 'take' | 'stash' | 'drive' | 'door' | 'machine' | 'station'

export interface Target {
  readonly kind: TargetKind
  /** The plot, npc, item, anchor, door, machine or station this points at. */
  readonly id: string
  /** What the prompt says, without the key. */
  readonly label: string
  readonly at: Vec2
}

const CONE = Math.cos(Math.PI / 3)

/**
 * What the player would act on if they pressed the key: the nearest thing in
 * front of them, within reach. Distance and facing rather than a ray, because
 * everything you can act on is a place on the floor, not a surface.
 */
export function pick(from: Vec2, heading: number, targets: readonly Target[], range = METRICS.player.interactRange): Target | undefined {
  const forward = { x: -Math.sin(heading), z: -Math.cos(heading) }
  let best: { target: Target; score: number } | undefined

  for (const target of targets) {
    const dx = target.at.x - from.x
    const dz = target.at.z - from.z
    const distance = Math.hypot(dx, dz)
    if (distance > range) continue

    const facing = distance < 0.2 ? 1 : (dx * forward.x + dz * forward.z) / distance
    if (facing < CONE) continue

    const score = facing / Math.max(0.3, distance)
    if (!best || score > best.score) best = { target, score }
  }
  return best?.target
}

/** Everything the player could act on where they are standing. */
export class Targeting {
  #world: World
  #doors: StreetDoors
  #buildings: Buildings
  #stashing: Stashing
  #street: Street
  #driving: Driving
  #locks: Locks
  #machines: Machines
  #travel: Travel | undefined

  constructor(input: {
    world: World
    city: CityBuild
    buildings: Buildings
    stashing: Stashing
    street: Street
    driving: Driving
    locks: Locks
    machines: Machines
    /** Where fast travel boards. A city with nowhere to ride offers none. */
    travel?: Travel
  }) {
    this.#world = input.world
    this.#doors = new StreetDoors(input.world, input.city)
    this.#buildings = input.buildings
    this.#stashing = input.stashing
    this.#street = input.street
    this.#driving = input.driving
    this.#locks = input.locks
    this.#machines = input.machines
    this.#travel = input.travel
  }

  /**
   * What is worth offering from where the player is standing. A street's doors
   * are narrowed to `range` first: `pick` throws away anything further off
   * anyway, and a big city has more doors than a frame can afford to list.
   */
  list(from: Vec2, range: number = METRICS.player.interactRange): Target[] {
    const wheel = this.#driving.target()
    // behind the wheel the door out is the only thing in reach
    if (this.#driving.aboard) return wheel ? [wheel] : []
    if (!this.#buildings.outdoors) return this.#inTheRoom()
    const street = this.#inTheStreet(from, range)
    if (wheel) street.push(wheel)
    return street
  }

  #inTheStreet(from: Vec2, range: number): Target[] {
    const doors = this.#doors.near(from, range).map((door) => ({
      kind: 'enter' as const,
      id: door.plotId,
      label: `Go into ${door.name}`,
      at: { x: door.x, z: door.z },
    }))
    // somebody walking past is as talkable as somebody behind a counter
    const passers = this.#street.walkers().flatMap((walker) => {
      const npc = this.#world.npc(walker.id)
      if (!npc) return []
      return [{ kind: 'talk' as const, id: walker.id, label: `Talk to ${npc.name}`, at: { x: walker.x, z: walker.z } }]
    })
    // and the subway entrances, which open the plan on the stations rather
    // than going anywhere themselves. A town with fewer than two of them hands
    // back none, because there is no ride behind the prompt
    const stations = (this.#travel?.entrances() ?? []).map((station) => ({
      kind: 'station' as const,
      id: station.id,
      label: `Take the subway from ${station.name}`,
      at: station.at,
    }))
    return [...doors, ...passers, ...stations]
  }

  #inTheRoom(): Target[] {
    const place = this.#buildings.place
    const built = this.#buildings.inside
    if (place.kind !== 'interior' || !built) return []

    const targets: Target[] = [
      { kind: 'leave', id: place.plotId, label: 'Step outside', at: { x: built.entrance.x, z: built.entrance.z } },
    ]
    // only the people actually standing in here: somebody out walking the
    // street is drawn nowhere near this room and is not there to be talked to,
    // and offering them wins the prompt off whatever is really on the counter
    for (const person of this.#buildings.peopleHere()) {
      const npc = this.#world.npc(person.id)
      if (npc) targets.push({ kind: 'talk', id: person.id, label: `Talk to ${npc.name}`, at: { x: person.x, z: person.z } })
    }
    for (const [itemId, object] of built.pickups) {
      const item = this.#world.item(itemId)
      if (item && object.parent) {
        targets.push({ kind: 'take', id: itemId, label: `Take the ${item.name.toLowerCase()}`, at: { x: object.position.x, z: object.position.z } })
      }
    }
    // and the surfaces a job wants something left on, which are only here while
    // the player is carrying the thing it asked for
    for (const spot of this.#stashing.spots()) {
      targets.push({ kind: 'stash', id: spot.anchorId, label: `Leave the ${spot.itemName.toLowerCase()} here`, at: spot.at })
    }
    // a door still locked is something to open; one whose lock has come off is
    // a doorway like any other and is nothing to press
    for (const door of place.interior.doors) {
      if (door.from === 'outside' || !this.#locks.locked(door.id)) continue
      const room = place.interior.rooms.find((each) => each.id === door.to)
      targets.push({
        kind: 'door',
        id: door.id,
        label: `Unlock the door to ${room?.name ?? 'the next room'}`,
        at: { x: door.pos.x, z: door.pos.y },
      })
    }
    // and the screens on the desks, which are sat at rather than picked up
    for (const screen of this.#machines.here()) {
      targets.push({ kind: 'machine', id: screen.machineId, label: screen.label, at: screen.at })
    }
    return targets
  }
}
