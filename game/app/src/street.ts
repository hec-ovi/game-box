import { Crowd, CROWD_DEFAULTS, type Attention, type Companion, type CrowdCast, type Hazard, type Hazards } from '@gb/crowd'
import type { CityNav } from '@gb/nav'
import { CarPack, LaneGraph, Traffic, type Obstacle } from '@gb/traffic'
import { METRICS, type Npc, type World } from '@gb/world'
import * as THREE from 'three'
import { alsoBlockedBy, type Rolling } from './bodies.ts'
import { cityGround, citySolid, type Ground } from './solids.ts'
import type { Solid, Vec2 } from './walk.ts'

/**
 * How much of the town is out on the pavement at once. The rest are at their
 * posts, which is where the player goes looking for them: a town that empties
 * itself onto the street has nobody behind any counter in it.
 */
const OUT_TODAY = 1 / 3

/**
 * Metres of lane per car. One flat number for a whole town was picked when
 * every road was one lane each way; an avenue now carries four and the road out
 * six, so the same total spreads over twice the tarmac and the wide roads read
 * empty. Counting lane rather than town keeps a street as busy as it was and
 * gives the extra lanes their own cars. 110 m is what the number it replaces
 * came to on the size of town it was judged on.
 */
const LANE_PER_CAR = 110

/** The player's own car: solid to walk into, something traffic brakes for, and something nobody walks through. */
export interface PlayerCar {
  /** The car, driving or parked; nothing while the player has none. */
  readonly car: Rolling | undefined
  rolling(): readonly Rolling[]
  inTheRoad(): readonly { x: number; z: number; radius: number }[]
}

/** Where somebody is heading or standing out here: a building's door, or a spot on the ground. */
export type Whereabouts = { plotId: string } | { x: number; z: number }

/** Where a companion sets off from: a spot on the pavement, or the doorstep of the building they were in. */
export type SetOff = Pick<Companion, 'at'> | Pick<Companion, 'door'>

/** A car as the crowd reads one, mutable so the pool can be rewritten every frame. */
type OnTheRoad = Hazard & { x: number; z: number; vx: number; vz: number; footprint: { length: number; width: number; heading: number } }

/**
 * The street outside: its walls and its floor, the people on the pavement and
 * the cars on the road. The crowd and the traffic must not know about each
 * other, so this is where they are told what to look out for and nowhere else.
 */
export class Street {
  #world: World
  #nav: CityNav
  #ground: Ground | undefined
  #playerOutdoors: () => Vec2 | undefined
  #atWork: () => ReadonlySet<string>
  #crowd: Crowd | undefined
  #traffic: Traffic | undefined
  #cars: CarPack | undefined
  #playerCar: PlayerCar | undefined
  /** Who the crowd may send out today, kept current with who a job is waiting on. */
  #out: readonly Npc[] = []
  /**
   * Who is in the road, answered into the same two arrays every frame. Traffic
   * reads them once per update and keeps nothing, so a pool of bodies is safe
   * and a town of walkers costs no allocation to report.
   */
  #standing: { x: number; z: number }[] = []
  #inTheWay: Obstacle[] = []
  /** The cars, answered into one array the same way: the crowd reads it once a frame and keeps nothing. */
  #onTheRoad: OnTheRoad[] = []

  constructor(input: {
    world: World
    nav: CityNav
    ground?: Ground
    playerOutdoors: () => Vec2 | undefined
    /** Who has to stay at their post: everybody a job is waiting on. Nobody by default. */
    atWork?: () => ReadonlySet<string>
  }) {
    this.#world = input.world
    this.#nav = input.nav
    this.#ground = input.ground
    this.#playerOutdoors = input.playerOutdoors
    this.#atWork = input.atWork ?? (() => new Set())
  }

  /**
   * Put people on the pavement. A street with a few people on it reads as a
   * place; a street packed with them reads as a crowd scene, and nobody stands
   * out to talk to.
   *
   * The people out there are the city's own, so somebody the player passes is
   * somebody who lives here, can be named and can be talked to. Only a share of
   * the town is offered, so the buildings still have people standing in them.
   * The landscape is the ground under them, so a companion followed out of town
   * stands on the hillside rather than at zero.
   */
  populate(cast: CrowdCast): void {
    this.reconsider()
    this.#crowd = Crowd.create(
      {
        world: this.#world,
        nav: this.#nav,
        cast,
        hazards: this.hazards(),
        ...(this.#ground ? { ground: this.#ground } : {}),
        ...(this.#out.length > 0 ? { people: { street: (_serial, rng) => rng.pick(this.#out) } } : {}),
      },
      { population: 14 },
    )
  }

  /**
   * Who is out today, for the crowd to draw the street from. Three rules keep
   * the buildings from emptying onto the pavement: **nobody is the last person
   * out of a room**, so every building the player can walk into still has
   * somebody standing in it; no more than a share of the town is out at once,
   * so a bar keeps its regulars rather than its bartender on their own; and
   * **nobody a job is waiting on goes out**, so a step that sends the player to
   * somebody finds them at their post. Anybody the city stationed nowhere is
   * always out, because there is nowhere to look for them. The city's own order
   * decides, so the same town sends the same people out every time and
   * somebody found at their post is there on the next visit.
   */
  residents(): readonly Npc[] {
    const people = this.#world.npcs()
    const atWork = this.#atWork()
    const atTheirPost = new Map<string, number>()
    for (const npc of people) {
      const room = npc.station?.interiorId
      if (room) atTheirPost.set(room, (atTheirPost.get(room) ?? 0) + 1)
    }

    const share = Math.ceil(people.length * OUT_TODAY)
    const out: Npc[] = []
    let stationed = 0
    for (const npc of people) {
      const room = npc.station?.interiorId
      if (!room) {
        out.push(npc)
        continue
      }
      const left = atTheirPost.get(room) ?? 0
      if (stationed >= share || left <= 1 || atWork.has(npc.id)) continue
      atTheirPost.set(room, left - 1)
      stationed += 1
      out.push(npc)
    }
    return out
  }

  /** The board moved: whoever a job now waits on stays in, from the next person the crowd sends out. */
  reconsider(): void {
    this.#out = this.residents()
  }

  /**
   * Put cars on the roads. The models have to be parsed, so this is separate
   * from building the street: a city with no cars is still a city.
   */
  async openRoads(cars: ArrayBuffer, into: THREE.Object3D, near: Vec2): Promise<void> {
    const parked = new THREE.Group()
    parked.name = 'traffic'
    into.add(parked)

    try {
      const bodies = await CarPack.parse(cars, parked)
      const made = Traffic.fromWorld(this.#world, { bodies, obstacles: this.obstacles(), maxCars: this.carsWorthOf() })
      if (!made.ok) {
        console.warn(`no traffic (${made.error.code}); the roads stay empty`)
        return
      }
      made.value.populate(near)
      this.#traffic = made.value
      this.#cars = bodies
    } catch (cause) {
      console.warn(`no cars (${String(cause)}); the roads stay empty`)
    }
  }

  /**
   * How many cars this town's roads are worth: its own lanes, at one car per
   * `LANE_PER_CAR` metres of them. `@gb/traffic` holds its own floor of one car
   * per 40 m on top of this, so a short network cannot be flooded either way.
   */
  carsWorthOf(): number {
    const graph = LaneGraph.build(this.#world.toJSON().roads, {
      cellSize: METRICS.cellSize,
      carLength: METRICS.vehicle.carLength,
    })
    if (!graph.ok) return 0
    const metres = graph.value.lanes.reduce((lane, each) => lane + each.length, 0)
    return Math.round(metres / LANE_PER_CAR)
  }

  /** The car the player drives, once there is one. A `@gb/drive` `Driving` is one. */
  setPlayerCar(car: PlayerCar): void {
    this.#playerCar = car
  }

  /** The people, for `@gb/drive` to take a companion out of and hand them back to. */
  get people(): Crowd | undefined {
    return this.#crowd
  }

  /** The cars, once their art has loaded, for whoever wants to drive one. */
  get roads(): { traffic: Traffic; bodies: CarPack } | undefined {
    return this.#traffic && this.#cars ? { traffic: this.#traffic, bodies: this.#cars } : undefined
  }

  /** The walls, plus whoever is walking or driving in the way of them. */
  solid(): Solid {
    return alsoBlockedBy(
      citySolid(this.#world, this.#ground),
      () => this.#crowd?.walkers() ?? [],
      () => [...(this.#traffic?.cars() ?? []), ...(this.#playerCar?.rolling() ?? [])],
    )
  }

  /** How high the floor is: a kerb above the road in town, the land past it. */
  floor(): (x: number, z: number) => number {
    return cityGround(this.#world, this.#ground)
  }

  /**
   * The hour the cars are driving in, fractional so the lamps come up rather
   * than switch. They are lit whether or not the player is out in the street
   * to see it, because stepping out of a building must not be what turns the
   * headlights on.
   */
  setTime(clock: { secondsOfDay: number }): void {
    this.#cars?.setTime(clock.secondsOfDay / 3600)
  }

  update(seconds: number, near: Vec2): void {
    this.#crowd?.update(seconds, near)
    this.#traffic?.update(seconds, near)
    this.#cars?.update()
  }

  walkers(): readonly { id: string; x: number; z: number }[] {
    return this.#crowd?.walkers() ?? []
  }

  /** Whoever is walking with the player, in the order they joined. */
  following(): readonly { id: string; x: number; z: number }[] {
    return this.#crowd?.following() ?? []
  }

  /**
   * Where somebody out here is: the door they are walking to, so a job that
   * names them can point at where they will be, or the spot they are standing
   * on. Nothing for somebody who is not out here at all.
   */
  whereabouts(npcId: string): Whereabouts | undefined {
    const going = this.#crowd?.destination(npcId)
    if (going) return { plotId: going.plotId }
    const out = [...this.walkers(), ...this.following()].find((person) => person.id === npcId)
    return out ? { x: out.x, z: out.z } : undefined
  }

  /** Nobody follows anybody without a crowd to walk them. */
  get walkable(): boolean {
    return this.#crowd !== undefined
  }

  /** How close a conversation is held: past this the person is let go, on the pavement and behind a counter alike. */
  get talkRadius(): number {
    return this.#crowd?.options.talkRadius ?? CROWD_DEFAULTS.talkRadius
  }

  follow(npc: Npc, from: SetOff): void {
    this.#crowd?.follow({ npc, ...from })
  }

  stopFollowing(npcId: string): void {
    this.#crowd?.stopFollowing(npcId)
  }

  /**
   * Hold somebody on the pavement still and turn them to face a point: what
   * being talked to looks like. Nobody is held on a street with no crowd on it.
   */
  attend(npcId: string, x: number, y: number, z: number): Attention | undefined {
    return this.#crowd?.attend(npcId, x, y, z)
  }

  get walkerCount(): number {
    return this.#crowd?.count ?? 0
  }

  get carCount(): number {
    return this.#traffic?.count ?? 0
  }

  /**
   * What a pedestrian has to look out for before stepping off the kerb, and
   * cannot walk through: every car on the road as the box it is, and the
   * player's own car, parked or driving, standing still to the crowd because
   * `@gb/drive` publishes no speed. `@gb/traffic` points a nose down +Z, so a
   * car at `heading` is going the way `(sin, cos)` of it points. Answered into
   * the same array every frame: the crowd reads it once and keeps nothing.
   */
  hazards(): Hazards {
    return { near: (x, z, radius) => this.#carsNear(x, z, radius) }
  }

  #carsNear(x: number, z: number, radius: number): readonly Hazard[] {
    const reach = radius * radius
    let used = 0
    const consider = (car: Rolling, speed: number) => {
      const dx = car.x - x
      const dz = car.z - z
      if (dx * dx + dz * dz > reach) return
      const spot = (this.#onTheRoad[used] ??= {
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        radius: METRICS.vehicle.carLength / 2,
        footprint: { length: METRICS.vehicle.carLength, width: METRICS.vehicle.carWidth, heading: 0 },
      })
      spot.x = car.x
      spot.z = car.z
      spot.vx = Math.sin(car.heading) * speed
      spot.vz = Math.cos(car.heading) * speed
      spot.footprint.heading = car.heading
      used++
    }
    for (const car of this.#traffic?.cars() ?? []) consider(car, car.speed)
    const own = this.#playerCar?.car
    if (own) consider(own, 0)
    this.#onTheRoad.length = used
    return this.#onTheRoad
  }

  /**
   * Who a driver has to stop for: the people on the pavement and the road, and
   * the player, who is the one most likely to step out without looking.
   */
  obstacles() {
    return {
      near: (centre: { x: number; z: number }, radius: number) => {
        const reach = radius * radius
        let used = 0
        const consider = (x: number, z: number) => {
          const dx = x - centre.x
          const dz = z - centre.z
          if (dx * dx + dz * dz > reach) return
          // no radius: a person's width in a road is `@gb/traffic`'s own
          // number, and the body-collision capsule is a third of a metre,
          // which lets a car pass through a shoulder
          const spot = (this.#standing[used] ??= { x: 0, z: 0 })
          spot.x = x
          spot.z = z
          this.#inTheWay[used] = spot
          used++
        }
        for (const walker of this.#crowd?.walkers() ?? []) consider(walker.x, walker.z)
        for (const companion of this.#crowd?.following() ?? []) consider(companion.x, companion.z)
        const player = this.#playerOutdoors()
        if (player) consider(player.x, player.z)
        // and the player's own car, which a driver behind brakes for the same
        // way they brake for somebody standing in the road. It brings its own
        // rectangle, so it goes in as it comes rather than through the pool
        for (const patch of this.#playerCar?.inTheRoad() ?? []) {
          const dx = patch.x - centre.x
          const dz = patch.z - centre.z
          if (dx * dx + dz * dz <= reach) this.#inTheWay[used++] = patch
        }
        this.#inTheWay.length = used
        return this.#inTheWay
      },
    }
  }
}
