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
 * A ride is the veil, the move, and the veil away. The move is the player and
 * everybody walking with them put down a step off the other station's doorstep,
 * and it happens on the frame after the veil goes up so the city catches up
 * behind it: the frame that dresses a whole new neighbourhood is the one nobody
 * sees, and the veil comes off on the frame after that.
 */
export class Travel {
  #hud: Hud
  #body: Player
  #companions: Companions
  #stations: readonly Station[]
  #landing: Station | undefined
  #veiled = false

  constructor(input: { world: World; hud: Hud; city: CityBuild; body: Player; companions: Companions }) {
    this.#hud = input.hud
    this.#body = input.body
    this.#companions = input.companions
    this.#stations = input.world.stations().flatMap((plot) => {
      const at = input.city.doorsteps.get(plot.id)
      if (!at) return []
      return [{ id: plot.id, name: plot.name, cell: plot.entrance.cell, at, landing: offTheDoorstep(input.world, plot, at) }]
    })
  }

  /** Every station in town, as the plan draws them. */
  get marks(): MapStation[] {
    return this.#stations.map((station) => ({ id: station.id, name: station.name, x: station.cell.x, y: station.cell.y }))
  }

  /** Everything a player standing in the street could board, for the crosshair. */
  entrances(): readonly { id: string; name: string; at: Vec2 }[] {
    return this.#stations
  }

  /** The station the player is standing at, while they are standing at one. */
  boarding(at: Vec2): string | undefined {
    return this.#stations.find((station) => Math.hypot(station.at.x - at.x, station.at.z - at.z) <= METRICS.player.interactRange)?.id
  }

  /** Take the train. The veil goes up now and the ride lands on the next frame. */
  board(stationId: string): void {
    const station = this.#stations.find((each) => each.id === stationId)
    if (!station || station.id === this.boarding(this.#body.position)) return
    this.#landing = station
    this.#veiled = true
    this.#hud.show({ loading: { title: `To ${station.name}`, stages: [] } })
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
      return
    }
    if (!this.#veiled) return
    this.#veiled = false
    this.#hud.show({ loading: null })
  }
}
