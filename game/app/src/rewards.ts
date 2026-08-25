import type { PlayerState } from '@gb/play'
import type { Reward } from '@gb/quest'
import { PLAYER, type World } from '@gb/world'
import type { Garage } from './garage.ts'
import type { Locks } from './locks.ts'
import type { Reporting } from './reporting.ts'

/**
 * What a finished job hands over that the city and the street have to be told
 * about. `@gb/quest` pays the playthrough itself: the credits, the things, the
 * access, the car and the deed all land on `@gb/play` as the quest completes.
 * Two of them are also facts outside the playthrough, and this is where they
 * are written: whose a place is lives in the city file, and a car of the
 * player's stands somewhere on the street.
 */
export class Rewards {
  #world: World
  #player: PlayerState
  #locks: Locks
  #garage: Garage
  #report: Reporting

  constructor(input: { world: World; player: PlayerState; locks: Locks; garage: Garage; report: Reporting }) {
    this.#world = input.world
    this.#player = input.player
    this.#locks = input.locks
    this.#garage = input.garage
    this.#report = input.report
  }

  /**
   * The city is built again from its own file every time it is opened, so a
   * place the playthrough bought or was given is written back into it before
   * anything asks whose it is.
   */
  restore(): void {
    for (const interiorId of this.#player.owned()) {
      if (this.#world.interior(interiorId)?.owner !== PLAYER) this.#world.recordOwner(interiorId, PLAYER)
    }
  }

  /** A job paid out. */
  paid(reward: Reward): void {
    for (const access of reward.access ?? []) this.#locks.granted(access)
    if (reward.deed !== undefined) this.#home(reward.deed)
    if (reward.car !== undefined) this.#garage.putOut(reward.car)
  }

  /** A house handed over: the city says whose it is, and its door opens for them. */
  #home(interiorId: string): void {
    this.#world.recordOwner(interiorId, PLAYER)
    this.#locks.granted({ interiorId })
    const interior = this.#world.interior(interiorId)
    const plot = interior ? this.#world.plot(interior.plotId) : undefined
    this.#report.note(plot ? `${plot.name} is yours` : 'The place is yours')
  }
}
