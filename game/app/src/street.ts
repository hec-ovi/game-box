import { Crowd, type Attention, type CrowdCast } from '@gb/crowd'
import type { CityNav } from '@gb/nav'
import { CarPack, Traffic } from '@gb/traffic'
import { METRICS, type Npc, type World } from '@gb/world'
import * as THREE from 'three'
import { alsoBlockedBy, PERSON_CLEAR, type Rolling } from './bodies.ts'
import { cityGround, citySolid, type Ground } from './solids.ts'
import type { Solid, Vec2 } from './walk.ts'

/** The player's own car: solid to walk into, and something traffic brakes for. */
export interface PlayerCar {
  rolling(): readonly Rolling[]
  inTheRoad(): readonly { x: number; z: number; radius: number }[]
}

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
  #crowd: Crowd | undefined
  #traffic: Traffic | undefined
  #cars: CarPack | undefined
  #playerCar: PlayerCar | undefined

  constructor(input: { world: World; nav: CityNav; ground?: Ground; playerOutdoors: () => Vec2 | undefined }) {
    this.#world = input.world
    this.#nav = input.nav
    this.#ground = input.ground
    this.#playerOutdoors = input.playerOutdoors
  }

  /**
   * Put people on the pavement. A street with a few people on it reads as a
   * place; a street packed with them reads as a crowd scene, and nobody stands
   * out to talk to.
   *
   * The people out there are the city's own, so somebody the player passes is
   * somebody who lives here, can be named and can be talked to. The landscape
   * is the ground under them, so a companion followed out of town stands on the
   * hillside rather than at zero.
   */
  populate(cast: CrowdCast): void {
    const residents = this.residents()
    this.#crowd = Crowd.create(
      {
        world: this.#world,
        nav: this.#nav,
        cast,
        hazards: this.#onTheRoad(),
        ...(this.#ground ? { ground: this.#ground } : {}),
        ...(residents.length > 0 ? { people: { street: (_serial, rng) => rng.pick(residents) } } : {}),
      },
      { population: 14 },
    )
  }

  /** Everybody who lives in the city, for the crowd to draw the street from. */
  residents(): readonly Npc[] {
    return this.#world.npcs()
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
      const made = Traffic.fromWorld(this.#world, { bodies, obstacles: this.obstacles(), maxCars: 12 })
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
   * The hour the cars are driving in. Their lamps come on after dark, and they
   * are lit whether or not the player is out in the street to see it, because
   * stepping out of a building must not be what turns the headlights on.
   */
  setTime(clock: { hour: number; minute: number }): void {
    this.#cars?.setTime(clock.hour + clock.minute / 60)
  }

  update(seconds: number, near: Vec2): void {
    this.#crowd?.update(seconds, near)
    this.#traffic?.update(seconds, near)
    this.#cars?.update()
  }

  walkers(): readonly { id: string; x: number; z: number }[] {
    return this.#crowd?.walkers() ?? []
  }

  /** Nobody follows anybody without a crowd to walk them. */
  get walkable(): boolean {
    return this.#crowd !== undefined
  }

  follow(npc: Npc, at: Vec2): void {
    this.#crowd?.follow({ npc, at })
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
   * What a pedestrian has to look out for before stepping off the kerb. A car
   * that has already stopped is not coming, which is what keeps a car and a
   * pedestrian from deferring to each other forever.
   */
  #onTheRoad() {
    return {
      near: (x: number, z: number, radius: number) => {
        const reach = radius * radius
        return (this.#traffic?.cars() ?? [])
          .filter((car) => (car.x - x) ** 2 + (car.z - z) ** 2 <= reach)
          .map((car) => ({
            x: car.x,
            z: car.z,
            vx: -Math.sin(car.heading) * car.speed,
            vz: -Math.cos(car.heading) * car.speed,
            radius: METRICS.vehicle.carLength / 2,
          }))
      },
    }
  }

  /**
   * Who a driver has to stop for: the people on the pavement and the road, and
   * the player, who is the one most likely to step out without looking.
   */
  obstacles() {
    return {
      near: (centre: { x: number; z: number }, radius: number) => {
        const found: Array<{ x: number; z: number; radius: number }> = []
        const reach = radius * radius
        const consider = (x: number, z: number) => {
          const dx = x - centre.x
          const dz = z - centre.z
          if (dx * dx + dz * dz <= reach) found.push({ x, z, radius: PERSON_CLEAR })
        }
        for (const walker of this.#crowd?.walkers() ?? []) consider(walker.x, walker.z)
        for (const companion of this.#crowd?.following() ?? []) consider(companion.x, companion.z)
        const player = this.#playerOutdoors()
        if (player) consider(player.x, player.z)
        // and the player's own car, which a driver behind brakes for the same
        // way they brake for somebody standing in the road
        for (const patch of this.#playerCar?.inTheRoad() ?? []) {
          const dx = patch.x - centre.x
          const dz = patch.z - centre.z
          if (dx * dx + dz * dz <= reach) found.push(patch)
        }
        return found
      },
    }
  }
}
