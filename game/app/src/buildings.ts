import type { CastMember } from '@gb/cast'
import type { PlayerState } from '@gb/play'
import type { CityBuild, Dressing, InteriorBuild } from '@gb/scene'
import type { Interior, World } from '@gb/world'
import { alsoBlockedBy } from './bodies.ts'
import type { Bodies } from './members.ts'
import type { Locks } from './locks.ts'
import type { Player } from './player.ts'
import type { CityArt } from './rooms.ts'
import type { Stage } from './stage.ts'
import type { Sky } from './sky.ts'
import type { RoomArt } from './pack.ts'
import type { Screens } from './screens.ts'
import { furnishedSolid, gated } from './solids.ts'
import type { Street } from './street.ts'
import type { Vec2 } from './walk.ts'

/** Where the player is standing: out in the city, or inside one building. */
export type Place = { kind: 'city' } | { kind: 'interior'; interior: Interior; plotId: string }

/** Somebody actually standing at their post in the room the player is in. */
export interface AtTheirPost {
  readonly id: string
  readonly x: number
  readonly z: number
}

/** Somewhere a quest can be told the player arrived at. */
export type Arrival = { plotId: string } | { interiorId: string }

/**
 * Going into a building and coming back out. `@gb/scene` keeps the rooms: it
 * builds one on the first entry and lets it go once the player has walked far
 * enough from its building, so a room that is still standing is a scene swap
 * and one that was let go is built again from the file, dressed in its own art
 * and given back what this playthrough moved.
 */
export class Buildings {
  #world: World
  #player: PlayerState
  #locks: Locks
  #art: CityArt
  #room: RoomArt | undefined
  #screens: Screens | undefined
  #stage: Stage
  #body: Player
  #city: CityBuild
  #sky: Sky
  #street: Street
  #announce: (text: string) => void
  #arrived: (at: Arrival) => void
  #wentIn: (built: InteriorBuild, interior: Interior) => void
  #cameOut: (at: Vec2) => void
  #whoIsOut: () => Iterable<string>

  #place: Place = { kind: 'city' }
  #away = new Set<string>()
  #veil: (title: string) => void
  /** The bodies each standing room's own art drew, by interior id: its art spawned the people in it, so nobody else has them. */
  #drawn = new Map<string, Bodies>()

  constructor(input: {
    world: World
    player: PlayerState
    locks: Locks
    art: CityArt
    room?: RoomArt
    /** A video of the player's own on the televisions. Without one they play the town's own schedule. */
    screens?: Screens
    stage: Stage
    body: Player
    city: CityBuild
    sky: Sky
    street: Street
    announce: (text: string) => void
    arrived: (at: Arrival) => void
    /** The player is standing in the room: whoever came in with them can be stood in it. */
    wentIn?: (built: InteriorBuild, interior: Interior) => void
    cameOut: (at: Vec2) => void
    away: () => Iterable<string>
    veil?: (title: string) => void
  }) {
    this.#world = input.world
    this.#player = input.player
    this.#locks = input.locks
    this.#art = input.art
    this.#room = input.room
    this.#screens = input.screens
    this.#stage = input.stage
    this.#body = input.body
    this.#city = input.city
    this.#sky = input.sky
    this.#street = input.street
    this.#announce = input.announce
    this.#arrived = input.arrived
    this.#wentIn = input.wentIn ?? (() => {})
    this.#cameOut = input.cameOut
    this.#whoIsOut = input.away
    this.#veil = input.veil ?? (() => {})
  }

  get place(): Place {
    return this.#place
  }

  get outdoors(): boolean {
    return this.#place.kind === 'city'
  }

  /** The room the player is standing in, if they are standing in one. */
  get inside(): InteriorBuild | undefined {
    return this.#place.kind === 'interior' ? this.room(this.#place.interior.id) : undefined
  }

  /** The room of an interior that is standing, for whoever draws a body under it. Nothing is built to answer. */
  room(interiorId: string): InteriorBuild | undefined {
    return this.#city.interiors.has(interiorId) ? this.#city.interior(interiorId) : undefined
  }

  /**
   * The bodies the room the player is standing in was dressed with. An
   * interior is dressed by its own art, so the people at their posts in here
   * were spawned by that art and are in no other set: the city's own dressing
   * never saw them. Nothing outdoors, and nothing for a room whose art draws
   * no bodies of its own.
   */
  bodiesHere(): ReadonlyMap<string, CastMember> | undefined {
    if (this.#place.kind !== 'interior') return undefined
    return this.#drawn.get(this.#place.interior.id)?.()
  }

  enter(plotId: string): void {
    const plot = this.#world.plot(plotId)
    const interior = plot?.interiorId ? this.#world.interior(plot.interiorId) : undefined
    if (!interior) return
    // the door onto the street is a door like any other: locked, it is a wall
    // until the player has the key, the word or the deed
    const street = this.#locks.streetDoor(interior)
    if (street && !this.#locks.open(interior.id, street)) return

    const built = this.#build(interior)
    if (!built) return

    this.#veil(`Entering ${plot?.name ?? 'this building'}`)

    // somebody out in the street or walking with the player is not also
    // standing behind their own counter. The street stops while the player is
    // inside, so who is out is read once on the way in and kept.
    this.#away = new Set(this.#whoIsOut())
    for (const [npcId, body] of built.people) body.visible = !this.#away.has(npcId)

    this.#place = { kind: 'interior', interior, plotId }
    this.#screens?.dress(built, interior)
    this.#stage.show(built.root)
    this.#stage.indoors(true)
    this.#sky.visible = false
    // the gate of bars is not one of the room's own blockers: it stands while
    // its door is locked and is walked through the moment it is not
    const furniture = built.blockers.filter((piece) => piece.prop !== 'bars-door')
    const inside = gated(furnishedSolid(interior, furniture), interior, (doorId) => this.#locks.locked(doorId))
    this.#body.setSolid(alsoBlockedBy(inside, () => this.peopleHere()))
    this.#body.setGround(() => 0)

    const step = 1.2
    this.#body.placeAt(
      built.entrance.x + built.inward.x * step,
      built.entrance.z + built.inward.z * step,
      Math.atan2(-built.inward.x, -built.inward.z),
    )
    this.#announce(plot!.name)
    // a place walked into is a place found, for the codex
    this.#player.discover({ place: interior.id })
    this.#arrived({ plotId })
    this.#arrived({ interiorId: interior.id })
    this.#wentIn(built, interior)
  }

  leave(): void {
    if (this.#place.kind !== 'interior') return
    this.#veil('Back out on the street')
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

  /**
   * The room, standing or built again. `@gb/scene` builds it with the dressing
   * the city was built with, so the art of this one interior is aimed at it for
   * the length of the build: the shell is the scene's and the bays standing on
   * its walls are the furniture's. A room that was let go comes back as the
   * file wrote it, so everything this playthrough did to it goes on again.
   */
  #build(interior: Interior): InteriorBuild | undefined {
    const standing = this.room(interior.id)
    if (standing) return standing

    const charter = this.#world.charter(interior.kind)
    const room = charter ? this.#room?.(interior, charter) : undefined
    const built = this.#art.inRoom(room?.dressing, () => this.#city.interior(interior.id))
    if (!built) return undefined
    // this art spawned the people standing in here, so it is the only place
    // they can be looked up; a room built again is dressed again, and the set
    // it hands back this time is the one with the bodies now on the floor
    this.#remember(interior.id, room?.dressing)
    if (room) built.root.add(room.decor)
    this.#asLeft(built, interior.id)
    for (const [npcId, body] of built.people) body.visible = !this.#away.has(npcId)
    return built
  }

  /** Which set of bodies belongs to a room, and forget the rooms `@gb/scene` has let go since. */
  #remember(interiorId: string, art: Dressing | undefined): void {
    for (const id of this.#drawn.keys()) if (!this.#city.interiors.has(id)) this.#drawn.delete(id)
    const bodies = (art as { members?: Bodies } | undefined)?.members
    if (bodies) this.#drawn.set(interiorId, () => bodies.call(art))
    else this.#drawn.delete(interiorId)
  }

  /**
   * The room as this playthrough left it rather than as the city file wrote it.
   * `@gb/scene` builds every room from the world's own placements, which are
   * where things started: a thing in the player's pocket would be drawn on its
   * shelf as well, and a thing they left on a strongbox would be back on the
   * shelf it came from. Both are the same thing twice, and both can be picked
   * up again. Run once, when the room is built.
   */
  #asLeft(built: InteriorBuild, interiorId: string): void {
    for (const itemId of this.#player.inventory()) built.pickups.get(itemId)?.removeFromParent()
    for (const left of this.#player.placed()) {
      // wherever it is now, it is not where the city file drew it
      built.pickups.get(left.itemId)?.removeFromParent()
      if (left.interiorId === interiorId) built.leave(left.itemId, left.anchorId)
    }
  }

  /** The player's own source came up while they were standing in a room: the sets in it get it now. */
  dressScreens(): void {
    const built = this.inside
    if (built && this.#place.kind === 'interior') this.#screens?.dress(built, this.#place.interior)
  }

  /** Take a thing off the shelf it was drawn on. */
  lift(itemId: string): void {
    this.inside?.pickups.get(itemId)?.removeFromParent()
  }

  /**
   * Put a thing down on the surface an anchor belongs to. `@gb/scene` runs the
   * same rule it built the room's own things with, so a thing carried in from
   * across town lands where it would have landed had the room been built with
   * it there. Nothing drawn means the step named a spot this room has not got.
   */
  putDown(itemId: string, anchorId: string): boolean {
    return this.inside?.leave(itemId, anchorId) !== undefined
  }

  /** Somebody walking with the player is not also standing at their anchor. */
  showPerson(npcId: string, visible: boolean): void {
    if (visible) this.#away.delete(npcId)
    else this.#away.add(npcId)
    for (const interiorId of this.#city.interiors) {
      const body = this.#city.interior(interiorId)?.people.get(npcId)
      if (body) body.visible = visible
    }
  }

  /**
   * The people standing at their posts in the room the player is in. Whoever is
   * out on the street or walking with the player is not one of them, so the
   * crosshair does not offer them and the player does not walk into them.
   */
  peopleHere(): readonly AtTheirPost[] {
    const built = this.inside
    if (!built) return []
    const here: AtTheirPost[] = []
    for (const [id, body] of built.people) {
      if (this.#away.has(id)) continue
      here.push({ id, x: body.position.x, z: body.position.z })
    }
    return here
  }

  /**
   * Where the player is standing on the city, whichever side of a door they are
   * on: their own spot outside, and the doorstep of the building they are in.
   * A room is measured in its own metres from its own corner, so the number on
   * the map and the number the route starts from have to be this one.
   */
  cityPosition(): Vec2 {
    if (this.#place.kind !== 'interior') return this.#body.position
    return this.#city.doorsteps.get(this.#place.plotId) ?? this.#body.position
  }
}
