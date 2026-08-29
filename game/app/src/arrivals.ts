import type { Objective } from '@gb/quest'
import { METRICS } from '@gb/world'
import type { Arrival } from './buildings.ts'
import type { Vec2 } from './walk.ts'

/**
 * Close enough to a building to have got there, in metres.
 *
 * It is the reach the door itself is offered at, which is the one distance in
 * this game that already means "standing at this door": the frame the prompt
 * reads Go into Kell Supply is the frame the player has walked up to Kell
 * Supply, and the subway entrance the crosshair offers is boarded off the same
 * measure against the same doorstep (`Travel.boarding`). So the player can see
 * they have arrived: the prompt is the receipt. Anything looser credits a walk
 * from across the street, and anything tighter is a step nothing on screen says
 * they have taken.
 */
const REACHED = METRICS.player.interactRange

/**
 * Getting somewhere on foot.
 *
 * `@gb/quest` credits a `goto` step with `arrived`, and going through the door
 * is not the only way to get somewhere: a job that says to walk to the station
 * is done when the player is standing at the station, whether or not they open
 * it. So every frame out in the street measures them against the doorsteps of
 * the buildings the open steps name and reports the ones they have come to.
 *
 * Only those doorsteps. A town has thousands of them and the board is the only
 * reason to measure any, which is the narrowing `Escorts` does for the person
 * walking with the player. A doorstep is reported once for as long as a step is
 * waiting on it and again only once the player has left it and come back, so
 * standing at a door costs one event rather than one a frame.
 *
 * A step that names an interior is not one of these: a room is somewhere you
 * are inside, and `Buildings.enter` reports it on the way through the door.
 */
export class Arrivals {
  #steps: () => readonly Objective[]
  #doorstep: (plotId: string) => Vec2 | undefined
  #arrived: (at: Arrival) => void
  /** The buildings the open steps are waiting on, read again whenever the board moves. */
  #wanted: readonly string[] | undefined
  /** The ones the player is standing at, already reported. */
  #at = new Set<string>()

  constructor(input: {
    /** Every open step of every live quest. */
    steps: () => readonly Objective[]
    doorstep: (plotId: string) => Vec2 | undefined
    arrived: (at: Arrival) => void
  }) {
    this.#steps = input.steps
    this.#doorstep = input.doorstep
    this.#arrived = input.arrived
  }

  /** The board moved: which buildings the steps name is read again on the next frame. */
  dirty(): void {
    this.#wanted = undefined
  }

  /** One frame out in the street: whichever of those buildings the player has just come to. */
  update(at: Vec2): void {
    for (const plotId of this.#list()) {
      const door = this.#doorstep(plotId)
      if (!door || Math.hypot(at.x - door.x, at.z - door.z) > REACHED) {
        this.#at.delete(plotId)
        continue
      }
      if (this.#at.has(plotId)) continue
      this.#at.add(plotId)
      this.#arrived({ plotId })
    }
  }

  /**
   * The buildings the open steps say to walk to. A step carrying a place and
   * neither a person nor a thing is a `goto`: an escort names who walks and a
   * stash names what to put down, and both of those are credited by something
   * else happening. One entry per building, because two steps sending the
   * player to one door are one walk.
   *
   * Reading the list again forgets the doorsteps nothing is waiting on any
   * more. They are not measured while nothing wants them, so there is nothing
   * to remember, and a step that opens at a door the player is already standing
   * at is credited where they stand rather than sending them round the block.
   */
  #list(): readonly string[] {
    if (this.#wanted) return this.#wanted
    const wanted: string[] = []
    for (const step of this.#steps()) {
      const place = step.place
      if (!place || !('plotId' in place) || step.npcId || step.itemId) continue
      if (!wanted.includes(place.plotId)) wanted.push(place.plotId)
    }
    for (const plotId of this.#at) if (!wanted.includes(plotId)) this.#at.delete(plotId)
    this.#wanted = wanted
    return wanted
  }
}
