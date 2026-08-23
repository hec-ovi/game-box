import { err, ok, type Result } from '@gb/kit'
import { METRICS, type World } from '@gb/world'
import type { Car, CarHandover, CarView } from './car.ts'
import type { TrafficError } from './errors.ts'
import { distance, type Point } from './geometry.ts'
import { Hazards } from './hazards.ts'
import { CITY_DRIVING, idmAcceleration } from './idm.ts'
import { JunctionControl } from './junctions.ts'
import { LaneGraph } from './lane-graph.ts'
import { ahead, join, leave } from './queue.ts'
import { Runoffs } from './runoff.ts'
import { RUNOFF, withDefaults, type Settings, type TrafficOptions } from './settings.ts'
import { Spawner } from './spawner.ts'
import { Lane, Link } from './track.ts'

/** Metres of clear road a car leaves in front of the junction it is waiting for. */
const STOP_BUFFER = 1
/** Turn weights: most cars carry straight on. */
const TURN_MIX = { straight: 3, right: 1.5, left: 1 } as const
/** Metres of lane the city needs per car, so a small grid is never flooded into gridlock. */
const ROAD_PER_CAR = 40
/** Out of sight, a car stuck this long is taken away rather than left in a jam. */
const PATIENCE = 12
/** Cars created per update once the streets are already populated. */
const SPAWNS_PER_UPDATE = 2

const CAR_LENGTH = METRICS.vehicle.carLength

/**
 * Cars driving a generated city. Reads the road graph once, then every frame
 * moves what is on it: following the car in front, giving way at junctions,
 * appearing around the player and retiring behind them.
 */
export class Traffic {
  readonly graph: LaneGraph
  readonly #settings: Settings
  readonly #junctions: JunctionControl
  readonly #runoffs: Runoffs
  readonly #hazards: Hazards
  readonly #spawner: Spawner
  readonly #cars: Car[] = []
  /** How many cars this road network can hold: the option, held to what the roads carry. */
  readonly #capacity: number
  #now = 0
  #frame = 0
  #focus: Point = { x: 0, z: 0 }
  /** Reused every frame so a busy city does not allocate a car list per step. */
  readonly #due: Car[] = []

  private constructor(graph: LaneGraph, settings: Settings) {
    this.graph = graph
    this.#settings = settings
    const road = graph.lanes.reduce((total, lane) => total + lane.length, 0)
    this.#capacity = Math.max(1, Math.min(settings.maxCars, Math.floor(road / ROAD_PER_CAR)))
    this.#runoffs = new Runoffs(graph, RUNOFF)
    this.#hazards = new Hazards(settings.obstacles)
    this.#junctions = new JunctionControl(CAR_LENGTH + CITY_DRIVING.minGap, this.#hazards)
    this.#spawner = new Spawner(graph, settings, this.#hazards, CAR_LENGTH)
  }

  static fromWorld(world: World, options: TrafficOptions = {}): Result<Traffic, TrafficError> {
    const settings = withDefaults(options, world.seed)
    const graph = LaneGraph.build(world.toJSON().roads, { cellSize: world.cellSize, carLength: CAR_LENGTH })
    if (!graph.ok) return err(graph.error)
    return ok(new Traffic(graph.value, settings))
  }

  cars(): readonly CarView[] {
    return this.#cars
  }

  /**
   * Give a car to whoever is asking for it. The traffic forgets it entirely:
   * its place in the queue and any junction it was holding are given back, its
   * body goes to the pool, and another car may take its place on the road.
   *
   * What comes back is a snapshot rather than the live car, because from here
   * on it is somebody else's, and it is enough to carry on driving it: where it
   * was, which way it was pointing and how fast it was going.
   */
  handOver(carId: string): CarHandover | undefined {
    const index = this.#cars.findIndex((car) => car.id === carId)
    if (index < 0) return undefined
    const car = this.#cars[index]!
    this.#takeOff(index)
    return { id: car.id, model: car.model, x: car.x, z: car.z, heading: car.heading, speed: car.speed }
  }

  get count(): number {
    return this.#cars.length
  }

  /** Fill the streets around a point in one go, for the moment a city opens. */
  populate(focus: Point): void {
    this.#focus = focus
    this.#hazards.refresh([], focus, this.#settings.despawnRadius)
    while (this.#cars.length < this.#capacity) {
      if (!this.#add(focus)) return
    }
  }

  /**
   * One step. `dt` is seconds since the last call and `focus` is the player, or
   * whatever the traffic should be busy around.
   */
  update(dt: number, focus: Point): void {
    if (!Number.isFinite(dt) || dt <= 0) return
    this.#focus = focus
    this.#now += Math.min(dt, this.#settings.maxStep)
    this.#frame++

    const due = this.#collectDue()
    this.#hazards.refresh(due, focus, this.#settings.despawnRadius)
    for (const car of due) this.#approach(car)
    this.#junctions.settle()
    for (const car of due) car.accel = this.#decide(car)
    for (const car of due) this.#move(car)
    this.#retire(focus)
    for (let i = 0; i < SPAWNS_PER_UPDATE && this.#cars.length < this.#capacity; i++) {
      this.#add(focus)
    }
    for (const car of due) this.#show(car)
    for (const car of due) car.clock = this.#now
  }

  /** Near cars move every frame; far ones take their turn, one slot per frame. */
  #collectDue(): readonly Car[] {
    const { nearRadius, farStride } = this.#settings
    const near = nearRadius * nearRadius
    const turn = this.#frame % farStride
    const focus = this.#focus
    this.#due.length = 0
    for (const car of this.#cars) {
      const dx = car.x - focus.x
      const dz = car.z - focus.z
      if (farStride === 1 || car.slot % farStride === turn || dx * dx + dz * dz <= near) this.#due.push(car)
    }
    return this.#due
  }

  /** Choose the way across the junction ahead and ask for it. */
  #approach(car: Car): void {
    if (!(car.track instanceof Lane)) return
    const reach = Math.max(12, (car.speed * car.speed) / (2 * CITY_DRIVING.brake) + 6)
    if (car.remaining > reach) return
    if (!car.next) {
      const links = this.graph.linksFrom(car.track)
      if (links.length === 0) return // the graph ends here: it runs off the map, or stops
      car.next = this.#pickLink(links, car)
    }
    // only the car at the head of the queue takes the junction, so a held
    // junction always has someone able to drive into it
    if (!ahead(car)) this.#junctions.request(car, this.#now)
  }

  #pickLink(links: readonly Link[], car: Car): Link {
    return car.rng.weighted(links.map((link) => [link, TURN_MIX[link.turn]] as const))
  }

  #decide(car: Car): number {
    const lead = this.#leader(car)
    let accel = idmAcceleration(CITY_DRIVING, car.speed, car.desiredSpeed, lead.gap, car.speed - lead.speed)
    // somebody in the road is the car in front that never moves off: same
    // model, zero speed, so the braking is the braking a driver already does
    const person = this.#hazards.gapFor(car)
    if (person < Number.POSITIVE_INFINITY) {
      accel = Math.min(accel, idmAcceleration(CITY_DRIVING, car.speed, car.desiredSpeed, person, car.speed))
    }
    if (car.track instanceof Lane && car.next && car.holds !== car.next.junctionId) {
      const toStop = car.remaining - STOP_BUFFER
      const stopping = idmAcceleration(CITY_DRIVING, car.speed, car.desiredSpeed, toStop, car.speed)
      accel = Math.min(accel, stopping)
    }
    return accel
  }

  /** The car in front, on this track or on the one it is about to enter. */
  #leader(car: Car): { gap: number; speed: number } {
    const front = ahead(car)
    if (front) return { gap: front.s - car.s - CAR_LENGTH, speed: front.speed }
    const next = car.track instanceof Link ? car.track.to : car.next
    const first = next?.last
    if (next && first) return { gap: car.remaining + first.s - CAR_LENGTH, speed: first.speed }
    return { gap: Number.POSITIVE_INFINITY, speed: 0 }
  }

  #move(car: Car): void {
    const step = Math.min(this.#now - car.clock, this.#settings.maxStep)
    if (step <= 0) return
    const speed = Math.max(0, car.speed + car.accel * step)
    car.s += ((car.speed + speed) / 2) * step
    car.speed = speed
    car.stalled = speed < 0.1 ? car.stalled + step : 0
    this.#cross(car)
    car.place()
  }

  /** Hand a car on to the next piece of road, or hold it where the road stops. */
  #cross(car: Car): void {
    while (car.s >= car.track.length) {
      if (car.track instanceof Link) {
        const into = car.track.to
        const over = car.s - car.track.length
        leave(car.track, car)
        car.s = over
        join(into, car)
        car.next = undefined
        this.#junctions.release(car)
        continue
      }
      if (!(car.track instanceof Lane)) {
        // the end of the run off the map: it waits here for `#retire`
        car.s = car.track.length
        car.speed = 0
        return
      }
      const lane = car.track
      const link = car.next
      const into = link && car.holds === link.junctionId ? link : this.#runoffs.after(lane)
      if (!into) {
        car.s = lane.length
        car.speed = 0
        return
      }
      const over = car.s - lane.length
      leave(lane, car)
      car.s = over
      join(into, car)
    }
  }

  /**
   * Take away everything that has no business on the road any more: too far to
   * matter, or standing still somewhere the player cannot see it go. A car that
   * has run out of road counts as standing still, so the end of the map is the
   * jam rule and nothing else.
   */
  #retire(focus: Point): void {
    const { despawnRadius, nearRadius } = this.#settings
    for (let i = this.#cars.length - 1; i >= 0; i--) {
      const car = this.#cars[i]!
      const away = distance(car, focus)
      const jammed = car.stalled > PATIENCE && away > nearRadius
      if (!jammed && away <= despawnRadius) continue
      this.#takeOff(i)
    }
  }

  /** Off the road, out of the queue, out of the junction, body back to the pool. */
  #takeOff(index: number): void {
    const car = this.#cars[index]!
    leave(car.track, car)
    this.#junctions.release(car)
    if (car.body && this.#settings.bodies) {
      this.#settings.bodies.release(car.body, { id: car.id, model: car.model })
    }
    this.#cars.splice(index, 1)
  }

  #add(focus: Point): boolean {
    const car = this.#spawner.spawn(focus, this.#now)
    if (!car) return false
    this.#cars.push(car)
    if (this.#settings.bodies) car.body = this.#settings.bodies.acquire({ id: car.id, model: car.model })
    this.#show(car)
    return true
  }

  #show(car: Car): void {
    if (!car.body) return
    car.body.position.x = car.x
    car.body.position.y = this.#settings.rideHeight
    car.body.position.z = car.z
    car.body.rotation.y = car.heading
  }
}
