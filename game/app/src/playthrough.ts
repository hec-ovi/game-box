import type { PlayerState } from '@gb/play'
import type { QuestLog } from '@gb/quest'
import type { World } from '@gb/world'
import type { Buildings } from './buildings.ts'
import type { Companions } from './companions.ts'
import type { Player } from './player.ts'
import type { Reporting } from './reporting.ts'

/**
 * What a save has to say that the city file cannot. The city is built the same
 * way every time, so the rest is written down and put back: where the player
 * was standing and which side of a door they were on, whoever was walking with
 * them, and the job they were following.
 *
 * Nothing here decides anything. `@gb/play` holds all of it; this writes it and
 * reads it, and putting it back calls the same things the player's own keys do.
 */
export class Playthrough {
  #world: World
  #player: PlayerState
  #log: QuestLog
  #buildings: Buildings
  #body: Player
  #companions: Companions
  #report: Reporting

  constructor(input: {
    world: World
    player: PlayerState
    log: QuestLog
    buildings: Buildings
    body: Player
    companions: Companions
    report: Reporting
  }) {
    this.#world = input.world
    this.#player = input.player
    this.#log = input.log
    this.#buildings = input.buildings
    this.#body = input.body
    this.#companions = input.companions
    this.#report = input.report
  }

  /**
   * Where the player is standing, written down. Indoors it is the room's own
   * metres from its own corner, so the room goes with it: the same three
   * numbers without it put them somewhere out in the city.
   */
  write(): void {
    const place = this.#buildings.place
    this.#player.setWhere({
      x: this.#body.position.x,
      z: this.#body.position.z,
      heading: this.#body.heading,
      ...(place.kind === 'interior' ? { interiorId: place.interior.id } : {}),
    })
  }

  /** Everything the save knows that the city does not. True when there was a save. */
  resume(): boolean {
    this.#forgetLostSpots()
    this.#follow()
    // a save written with the clock held comes back held, as `@gb/play` keeps
    // it, and says so: a city where time never moves and nothing says why is
    // a city that looks broken
    if (this.#player.clock.paused) this.#report.note('Time held')
    const where = this.#player.where
    if (!where) return false

    // indoors first: a room is measured in its own metres from its own corner,
    // so the three numbers only mean anything once the player is through the
    // door they were behind
    const inside = where.interiorId ? this.#world.interior(where.interiorId) : undefined
    if (inside) this.#buildings.enter(inside.plotId)
    // a door that will not open for them any more leaves them out on the
    // pavement: those three numbers are that room's metres and mean nothing here
    if (!inside || !this.#buildings.outdoors) this.#body.placeAt(where.x, where.z, where.heading)
    // and whoever is with them sets off from beside them rather than from the
    // post the city just put them back on
    this.#companions.regroup(this.#buildings.cityPosition())
    return true
  }

  /**
   * A spot is two names to `@gb/play`, which never looks either of them up, so
   * a save can carry a room or a shelf this city has not got. Forgetting the
   * entry puts the thing back wherever the city file had it, which is somewhere
   * rather than nowhere.
   */
  #forgetLostSpots(): void {
    for (const left of this.#player.placed()) {
      const room = this.#world.interior(left.interiorId)
      if (!room?.anchors.some((anchor) => anchor.id === left.anchorId)) this.#player.place(left.itemId, null)
    }
  }

  /**
   * The job the player was following. To `@gb/play` it is a name and nothing
   * else, so one that has since been given up or was never in this city is
   * cleared rather than pointing the map at a quest nobody holds.
   */
  #follow(): void {
    const tracked = this.#player.tracked
    if (tracked === undefined) return
    const known = this.#log.journal().some((page) => page.questId === tracked)
    this.#report.track(known ? tracked : null)
  }
}
