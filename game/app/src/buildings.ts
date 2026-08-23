import { buildInterior, type Dressing, type CityBuild, type InteriorBuild } from '@gb/scene'
import type { Interior, World } from '@gb/world'
import { alsoBlockedBy } from './bodies.ts'
import type { Player } from './player.ts'
import type { Stage } from './renderer.ts'
import type { Sky } from './sky.ts'
import type { RoomArt } from './pack.ts'
import { furnishedSolid } from './solids.ts'
import type { Street } from './street.ts'
import type { Vec2 } from './walk.ts'

/** Where the player is standing: out in the city, or inside one building. */
export type Place = { kind: 'city' } | { kind: 'interior'; interior: Interior; plotId: string }

/** Somewhere a quest can be told the player arrived at. */
export type Arrival = { plotId: string } | { interiorId: string }

/**
 * Going into a building and coming back out. An interior is built the first
 * time somebody opens the door and kept after that, so the second visit is a
 * scene swap rather than a rebuild.
 */
export class Buildings {
  #world: World
  #dressing: Dressing
  #room: RoomArt | undefined
  #stage: Stage
  #body: Player
  #city: CityBuild
  #sky: Sky
  #street: Street
  #announce: (text: string) => void
  #arrived: (at: Arrival) => void
  #cameOut: (at: Vec2) => void
  #away: () => Iterable<string>

  #built = new Map<string, InteriorBuild>()
  #place: Place = { kind: 'city' }

  constructor(input: {
    world: World
    dressing: Dressing
    room?: RoomArt
    stage: Stage
    body: Player
    city: CityBuild
    sky: Sky
    street: Street
    announce: (text: string) => void
    arrived: (at: Arrival) => void
    cameOut: (at: Vec2) => void
    away: () => Iterable<string>
  }) {
    this.#world = input.world
    this.#dressing = input.dressing
    this.#room = input.room
    this.#stage = input.stage
    this.#body = input.body
    this.#city = input.city
    this.#sky = input.sky
    this.#street = input.street
    this.#announce = input.announce
    this.#arrived = input.arrived
    this.#cameOut = input.cameOut
    this.#away = input.away
  }

  get place(): Place {
    return this.#place
  }

  get outdoors(): boolean {
    return this.#place.kind === 'city'
  }

  /** The room the player is standing in, if they are standing in one. */
  get inside(): InteriorBuild | undefined {
    return this.#place.kind === 'interior' ? this.#built.get(this.#place.interior.id) : undefined
  }

  enter(plotId: string): void {
    const plot = this.#world.plot(plotId)
    const interior = plot?.interiorId ? this.#world.interior(plot.interiorId) : undefined
    if (!interior) return

    let built = this.#built.get(interior.id)
    if (!built) {
      // the shell is `@gb/scene`'s and the bays standing on its walls are the
      // furniture's, so a room is built with its own dressing and then handed
      // the run of bays that goes with it
      const room = this.#room?.(interior)
      built = buildInterior(this.#world, interior, room?.dressing ?? this.#dressing)
      if (room) built.root.add(room.decor)
      this.#built.set(interior.id, built)
    }

    // somebody out in the street or walking with the player is not also
    // standing behind their own counter
    const away = new Set(this.#away())
    for (const [npcId, body] of built.people) body.visible = !away.has(npcId)

    this.#place = { kind: 'interior', interior, plotId }
    this.#stage.show(built.root)
    this.#stage.indoors(true)
    this.#sky.visible = false
    this.#body.setSolid(alsoBlockedBy(furnishedSolid(interior, built.blockers), () => this.#peopleInHere()))
    this.#body.setGround(() => 0)

    const step = 1.2
    this.#body.placeAt(
      built.entrance.x + built.inward.x * step,
      built.entrance.z + built.inward.z * step,
      Math.atan2(-built.inward.x, -built.inward.z),
    )
    this.#announce(plot!.name)
    this.#arrived({ plotId })
    this.#arrived({ interiorId: interior.id })
  }

  leave(): void {
    if (this.#place.kind !== 'interior') return
    const doorstep = this.#city.doorsteps.get(this.#place.plotId)
    this.#place = { kind: 'city' }
    this.#stage.show(this.#city.root)
    this.#stage.indoors(false)
    this.#sky.visible = true
    this.#body.setSolid(this.#street.solid())
    this.#body.setGround(this.#street.floor())
    if (!doorstep) return
    this.#body.placeAt(doorstep.x, doorstep.z)
    this.#cameOut({ x: doorstep.x, z: doorstep.z })
  }

  /** Take a thing off the shelf it was drawn on. */
  lift(itemId: string): void {
    this.inside?.pickups.get(itemId)?.removeFromParent()
  }

  /** Somebody walking with the player is not also standing at their anchor. */
  showPerson(npcId: string, visible: boolean): void {
    for (const built of this.#built.values()) {
      const body = built.people.get(npcId)
      if (body) body.visible = visible
    }
  }

  /** The people standing about in the room the player is in. */
  #peopleInHere(): readonly Vec2[] {
    const built = this.inside
    return [...(built?.people.values() ?? [])].map((body) => ({ x: body.position.x, z: body.position.z }))
  }
}
