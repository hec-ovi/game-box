import type { Driving } from '@gb/drive'
import type { CityBuild } from '@gb/scene'
import { METRICS, type World } from '@gb/world'
import type { Buildings } from './buildings.ts'
import type { Street } from './street.ts'
import type { Vec2 } from './walk.ts'

export type TargetKind = 'enter' | 'leave' | 'talk' | 'take' | 'drive'

export interface Target {
  readonly kind: TargetKind
  /** The plot, npc or item this points at. */
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
  #city: CityBuild
  #buildings: Buildings
  #street: Street
  #driving: Driving

  constructor(input: { world: World; city: CityBuild; buildings: Buildings; street: Street; driving: Driving }) {
    this.#world = input.world
    this.#city = input.city
    this.#buildings = input.buildings
    this.#street = input.street
    this.#driving = input.driving
  }

  list(): Target[] {
    const wheel = this.#driving.target()
    // behind the wheel the door out is the only thing in reach
    if (this.#driving.aboard) return wheel ? [wheel] : []
    if (!this.#buildings.outdoors) return this.#inTheRoom()
    return wheel ? [...this.#inTheStreet(), wheel] : this.#inTheStreet()
  }

  #inTheStreet(): Target[] {
    const doors = this.#world.plots().flatMap((plot) => {
      const doorstep = this.#city.doorsteps.get(plot.id)
      if (!doorstep || !plot.interiorId) return []
      return [{ kind: 'enter' as const, id: plot.id, label: `Go into ${plot.name}`, at: { x: doorstep.x, z: doorstep.z } }]
    })
    // somebody walking past is as talkable as somebody behind a counter
    const passers = this.#street.walkers().flatMap((walker) => {
      const npc = this.#world.npc(walker.id)
      if (!npc) return []
      return [{ kind: 'talk' as const, id: walker.id, label: `Talk to ${npc.name}`, at: { x: walker.x, z: walker.z } }]
    })
    return [...doors, ...passers]
  }

  #inTheRoom(): Target[] {
    const place = this.#buildings.place
    const built = this.#buildings.inside
    if (place.kind !== 'interior' || !built) return []

    const targets: Target[] = [
      { kind: 'leave', id: place.plotId, label: 'Step outside', at: { x: built.entrance.x, z: built.entrance.z } },
    ]
    for (const [npcId, body] of built.people) {
      const npc = this.#world.npc(npcId)
      if (npc) targets.push({ kind: 'talk', id: npcId, label: `Talk to ${npc.name}`, at: { x: body.position.x, z: body.position.z } })
    }
    for (const [itemId, object] of built.pickups) {
      const item = this.#world.item(itemId)
      if (item && object.parent) {
        targets.push({ kind: 'take', id: itemId, label: `Take the ${item.name.toLowerCase()}`, at: { x: object.position.x, z: object.position.z } })
      }
    }
    return targets
  }
}
