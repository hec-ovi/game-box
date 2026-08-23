import { away } from './geometry.ts'
import type { DriveGround, Point, RiderBody, Riders, DriveSolid } from './ports.ts'
import { DOORS, PASSENGERS, SEAT_DROP, spotAt, type Spot } from './seats.ts'

/** What a seated body plays. The cast ships it; a cast without it stays idle. */
export const DRIVING_CLIP = 'Driving_Loop'

interface Seated {
  readonly npcId: string
  readonly spot: Spot
  readonly body: RiderBody
}

/**
 * Who is riding with the player. Companions are taken out of the crowd when the
 * player gets in and handed straight back when they get out, so nobody is ever
 * both walking the pavement and sitting in the back.
 *
 * Only as many come as there are seats. Anybody left over keeps following on
 * foot, which is the crowd's own business and not this box's.
 */
export class Cabin {
  readonly #riders: Riders | undefined
  #seated: Seated[] = []

  constructor(riders?: Riders) {
    this.#riders = riders
  }

  get count(): number {
    return this.#seated.length
  }

  /** Who is in the car, by npc id, in the order they took their seats. */
  aboard(): readonly string[] {
    return this.#seated.map((rider) => rider.npcId)
  }

  /** Everybody following the player takes a seat, as far as the seats go. */
  board(): void {
    if (!this.#riders) return
    for (const npcId of this.#riders.waiting().slice(0, PASSENGERS.length)) {
      const body = this.#riders.pickUp(npcId)
      if (body) {
        body.play(DRIVING_CLIP)
        this.#seated.push({ npcId, spot: PASSENGERS[this.#seated.length]!, body })
      }
    }
  }

  /** Move everybody with the car. Called every frame the player is driving. */
  carry(car: Point, heading: number, ground: DriveGround): void {
    for (const rider of this.#seated) {
      const at = spotAt(car, heading, rider.spot)
      rider.body.placeAt(at.x, ground(car.x, car.z) + SEAT_DROP, at.z)
      // a crowd body at heading 0 looks north (-Z) and the car's nose is +Z, so
      // somebody facing the way the car is going is half a turn round from it
      rider.body.faceTo(heading + Math.PI)
    }
  }

  /**
   * Everybody out, onto the first clear patch of pavement beside the car. They
   * go back to the crowd, so they walk with the player again from where they
   * stood up.
   */
  alight(car: Point, heading: number, solid: DriveSolid, taken: readonly Point[]): void {
    const spare: Point[] = [...taken]
    for (const rider of this.#seated) {
      const at = doorFor(car, heading, solid, spare) ?? car
      spare.push(at)
      rider.body.release()
      this.#riders?.putDown(rider.npcId, at.x, at.z)
    }
    this.#seated = []
  }

  /** The car is gone and so is everybody in it: bodies back, nobody put down. */
  clear(): void {
    for (const rider of this.#seated) rider.body.release()
    this.#seated = []
  }
}

/** The nearest door with clear ground behind it that nobody has stepped into yet. */
export function doorFor(
  car: Point,
  heading: number,
  solid: DriveSolid,
  taken: readonly Point[],
): Point | undefined {
  for (const door of DOORS) {
    const at = spotAt(car, heading, door)
    if (solid(at.x, at.z)) continue
    if (taken.some((other) => away(other, at) < 0.8)) continue
    return at
  }
  return undefined
}
