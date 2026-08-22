import type { Car } from './car.ts'
import { rightOf } from './geometry.ts'

/**
 * Who may cross. One car is in a junction at a time: it takes the junction as
 * it approaches, keeps it while it is inside, and gives it back on the far
 * side. Between cars that arrive together the rule is the one everybody drives
 * by, give way to the right, and when all arms claim at once the earliest claim
 * goes first, so a four way standoff resolves the same way every run.
 */
export class JunctionControl {
  readonly #held = new Map<string, Car>()
  readonly #waiting = new Map<string, Car[]>()
  /** Room a car needs on the far side before it is let in, metres. */
  readonly #exitRoom: number

  constructor(exitRoom: number) {
    this.#exitRoom = exitRoom
  }

  occupant(junctionId: string): Car | undefined {
    return this.#held.get(junctionId)
  }

  /**
   * A car asks for the junction its chosen link crosses. A car that already has
   * it keeps it only while the road out still has room, which is what stops a
   * queue that has stopped moving from locking the junction for everybody.
   */
  request(car: Car, now: number): void {
    const link = car.next
    if (!link) return
    if (car.holds === link.junctionId) {
      if (!this.#hasRoom(car)) this.release(car)
      return
    }
    if (car.claimedAt === 0) car.claimedAt = now
    const queue = this.#waiting.get(link.junctionId)
    if (queue) queue.push(car)
    else this.#waiting.set(link.junctionId, [car])
  }

  /** Hand each free junction to one of the cars waiting for it. */
  settle(): void {
    for (const [junctionId, queue] of this.#waiting) {
      if (queue.length > 0 && !this.#held.has(junctionId)) {
        const winner = pick(queue)
        if (winner && this.#hasRoom(winner)) {
          this.#held.set(junctionId, winner)
          winner.holds = junctionId
        }
      }
      queue.length = 0
    }
  }

  release(car: Car): void {
    if (car.holds === undefined) return
    if (this.#held.get(car.holds) === car) this.#held.delete(car.holds)
    car.holds = undefined
    car.claimedAt = 0
  }

  /** Never enter a junction you cannot leave: the lane out has to have room. */
  #hasRoom(car: Car): boolean {
    const exit = car.next?.to
    if (!exit) return false
    const last = exit.last
    return last === undefined || last.s > this.#exitRoom
  }
}

/** The first claimant nobody has priority over, or the earliest if they all yield. */
function pick(queue: readonly Car[]): Car | undefined {
  const order = [...queue].sort((a, b) => a.claimedAt - b.claimedAt || (a.id < b.id ? -1 : 1))
  return order.find((car) => !order.some((other) => other !== car && yieldsTo(car, other))) ?? order[0]
}

/** True when `other` comes at the junction from `car`'s right. */
function yieldsTo(car: Car, other: Car): boolean {
  const mine = car.next?.from.direction
  const theirs = other.next?.from.direction
  if (!mine || !theirs) return false
  const side = rightOf(mine)
  return side.x * theirs.x + side.z * theirs.z < -0.5
}
