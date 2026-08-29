import type { Hud, MapStation } from '@gb/hud'
import type { CityBuild } from '@gb/scene'
import { METRICS, type World } from '@gb/world'
import type { Companions } from './companions.ts'
import type { Player } from './player.ts'
import { offTheDoorstep, type Standing } from './spawn.ts'
import type { Vec2 } from './walk.ts'

/** One subway entrance: where it is on the plan, where it is in metres, and where a train puts you down. */
interface Station {
  readonly id: string
  readonly name: string
  /** The entrance cell, for the plan. */
  readonly cell: { x: number; y: number }
  /** The doorstep the entrance stands on, in metres. */
  readonly at: Vec2
  /** A step off it, which is where the ride ends. */
  readonly landing: Standing
}

/**
 * Fast travel. `@gb/world` says which plots a train boards at (`stations()`,
 * every plot whose charter runs a subway) and `@gb/kitbash` draws the entrance
 * on that plot's doorstep, so walking up to one is walking up to its doorstep.
 *
 * How many there are is the writing's, not the layout's, so a town boards
 * nowhere, in one place, or in several, and all three have to read honestly. A
 * ride goes from one entrance to another, so a town with fewer than two of them
 * has nowhere to ride: it offers no prompt on the entrance it does have and
 * carries nobody, and the map says which of those situations the player is in.
 *
 * A ride is the veil, the move, and the veil away. The move is the player and
 * everybody walking with them put down a step off the other station's doorstep,
 * and it happens on the frame after the veil goes up so the city catches up
 * behind it: the frame that dresses a whole new neighbourhood is the one nobody
 * sees, and the veil comes off on the frame after that.
 */
export class Travel {
  #hud: Hud
  #body: Player
  #city: CityBuild
  #companions: Companions
  #stations: readonly Station[]
  #landing: Station | undefined
  #veiled = false

  constructor(input: { world: World; hud: Hud; city: CityBuild; body: Player; companions: Companions }) {
    this.#hud = input.hud
    this.#body = input.body
    this.#city = input.city
    this.#companions = input.companions
    this.#stations = input.world.stations().flatMap((plot) => {
      const at = input.city.doorsteps.get(plot.id)
      if (!at) return []
      return [{ id: plot.id, name: plot.name, cell: plot.entrance.cell, at, landing: offTheDoorstep(input.world, plot, at) }]
    })
  }

  /**
   * Every station in town, as the plan draws them, however many that is. A town
   * that boards nowhere marks nothing, which is what the map reads to say so.
   */
  get marks(): MapStation[] {
    return this.#stations.map((station) => ({ id: station.id, name: station.name, x: station.cell.x, y: station.cell.y }))
  }

  /** Whether there is anywhere to ride at all: a train goes from one entrance to another. */
  get #rideable(): boolean {
    return this.#stations.length > 1
  }

  /**
   * Everything a player standing in the street could board, for the crosshair.
   * A town with nowhere to ride offers none of it: an entrance the player can
   * walk up to and be told to take a subway from, when the only train there is
   * boards where they are standing, is a prompt that promises a journey the
   * game cannot make.
   */
  entrances(): readonly { id: string; name: string; at: Vec2 }[] {
    return this.#rideable ? this.#stations : []
  }

  /** The station the player is standing at, while they are standing at one. */
  boarding(at: Vec2): string | undefined {
    return this.#stations.find((station) => Math.hypot(station.at.x - at.x, station.at.z - at.z) <= METRICS.player.interactRange)?.id
  }

  /** Take the train. The veil goes up now and the ride lands on the next frame. */
  board(stationId: string): void {
    const station = this.#stations.find((each) => each.id === stationId)
    // nowhere to ride carries nobody, and nobody rides to where they already
    // stand: a town with one entrance is both of those at once
    if (!station || !this.#rideable || station.id === this.boarding(this.#body.position)) return
    this.#landing = station
    this.#veiled = true
    this.#hud.show({ loading: { title: `To ${station.name}`, veil: true } })
  }

  /**
   * One frame of a ride. The landing happens under the veil, so the frame that
   * follows it draws a neighbourhood the city has never dressed; the veil comes
   * off on the frame after that, which is the first one the player would see.
   */
  update(): void {
    if (this.#landing) {
      const { x, z, heading } = this.#landing.landing
      this.#landing = undefined
      this.#body.placeAt(x, z, heading)
      // and whoever was walking with them got on the same train
      this.#companions.regroup({ x, z })
      // the frame budget is for walking: a neighbourhood the city has never
      // drawn is built whole here, under the veil, rather than assembling
      // itself in front of somebody who just stepped off a train
      this.#city.follow(x, z)
      this.#city.settle()
      return
    }
    if (!this.#veiled) return
    this.#veiled = false
    this.#hud.show({ loading: null })
  }
}
