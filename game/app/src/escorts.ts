import type { Objective } from '@gb/quest'
import type { World } from '@gb/world'
import type { Arrival } from './buildings.ts'
import { interiorPlot } from './places.ts'

/** Close enough to a doorstep to have arrived at the building, in metres. */
const ARRIVED = 4

/** Somebody walking with the player, and where they are. */
export interface Walking {
  readonly id: string
  readonly x: number
  readonly z: number
}

/** A step that wants somebody walked somewhere: who, where, and the key it is reported under. */
interface Escort {
  readonly npcId: string
  readonly place: Arrival
  readonly plotId: string
  readonly key: string
}

/**
 * Walking somebody somewhere. `@gb/quest` credits an escort by one event,
 * `companion-arrived`, sent when that person's body gets to the place the step
 * names: the companion flag says they agreed to come, and agreeing is not
 * arriving. Out in the street their body is measured against the doorstep of
 * the building, because that is where the walk ends; going through the door
 * with the player takes them in with them. Each arrival is reported once,
 * until they have walked away again.
 */
export class Escorts {
  #world: World
  #steps: () => readonly Objective[]
  #doorstep: (plotId: string) => { x: number; z: number } | undefined
  #walking: () => readonly Walking[]
  #arrived: (npcId: string, place: Arrival) => void
  #escorts: Escort[] | undefined
  #reported = new Set<string>()

  constructor(input: {
    world: World
    /** Every open step of every live quest. */
    steps: () => readonly Objective[]
    doorstep: (plotId: string) => { x: number; z: number } | undefined
    walking: () => readonly Walking[]
    arrived: (npcId: string, place: Arrival) => void
  }) {
    this.#world = input.world
    this.#steps = input.steps
    this.#doorstep = input.doorstep
    this.#walking = input.walking
    this.#arrived = input.arrived
  }

  /** The board moved: which steps are escorts is read again on the next frame. */
  dirty(): void {
    this.#escorts = undefined
  }

  /** One frame out in the street: whoever is walking with the player and has reached their door. */
  update(): void {
    const escorts = this.#list()
    if (escorts.length === 0) return
    const walking = this.#walking()
    for (const escort of escorts) {
      const body = walking.find((person) => person.id === escort.npcId)
      const door = body && this.#doorstep(escort.plotId)
      const there = body && door ? Math.hypot(body.x - door.x, body.z - door.z) <= ARRIVED : false
      if (there) this.#report(escort)
      else this.#reported.delete(escort.key)
    }
  }

  /** The player went through a door, and everybody walking with them went in too. */
  entered(place: Arrival, companions: readonly string[]): void {
    for (const escort of this.#list()) {
      if (!companions.includes(escort.npcId) || !same(escort.place, place)) continue
      this.#report(escort)
    }
  }

  #report(escort: Escort): void {
    if (this.#reported.has(escort.key)) return
    this.#reported.add(escort.key)
    this.#arrived(escort.npcId, escort.place)
  }

  /**
   * The steps that walk somebody somewhere: an objective naming who and where
   * with nothing to carry is an escort, the one kind that carries both.
   */
  #list(): readonly Escort[] {
    if (this.#escorts) return this.#escorts
    const found: Escort[] = []
    for (const step of this.#steps()) {
      const place = step.place
      if (!step.npcId || !place || step.itemId) continue
      const plotId = 'plotId' in place ? place.plotId : interiorPlot(this.#world, place.interiorId)
      if (!plotId) continue
      found.push({ npcId: step.npcId, place, plotId, key: `${step.npcId}@${'plotId' in place ? place.plotId : place.interiorId}` })
    }
    this.#escorts = found
    return found
  }
}

function same(a: Arrival, b: Arrival): boolean {
  if ('plotId' in a) return 'plotId' in b && a.plotId === b.plotId
  return 'interiorId' in b && a.interiorId === b.interiorId
}
