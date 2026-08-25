/**
 * Put cars on the streets of the test town and count how often a pedestrian
 * ends up inside one. The cars drive the lanes at a street's speed, brake for
 * anybody in the lane ahead the way `@gb/traffic` does, and wrap round at the
 * edge of town, so the case being measured is the one the game has: a car
 * stopped for somebody in the road, and that somebody walking on.
 *
 *   node tools/dodge-cars.ts [seconds] [seed]
 *
 * It reports walker-frames spent inside a car, within personal space of one,
 * and what the crowd costs per update with the cars there and without.
 */
import { CityNav } from '@gb/nav'
import { METRICS } from '@gb/world'
import { Crowd, type CrowdActor, type CrowdCast, type Hazard, type Hazards, type Point } from '../src/index.ts'
import { testTown } from '../tests/support/town.ts'

const STEP = 1 / 60
const SPEED = 8.5
const LENGTH = METRICS.vehicle.carLength
const WIDTH = METRICS.vehicle.carWidth
/** Cars queue behind whoever is in their lane this far ahead, in metres. */
const BRAKE_AHEAD = 6
/** Cars start this far apart along a lane, in metres. */
const SPACING = 36

const NOBODY: CrowdCast = {
  spawn(): CrowdActor {
    return { placeAt() {}, faceTo() {}, play() {}, release() {} }
  },
}

class Car implements Hazard {
  x: number
  z: number
  vx = 0
  vz = 0
  readonly radius = LENGTH / 2
  readonly footprint: { length: number; width: number; heading: number }
  /** Unit direction of travel. */
  readonly dx: number
  readonly dz: number
  #speed = SPEED

  constructor(x: number, z: number, dx: number, dz: number) {
    this.x = x
    this.z = z
    this.dx = dx
    this.dz = dz
    this.footprint = { length: LENGTH, width: WIDTH, heading: Math.atan2(-dx, -dz) }
    this.vx = dx * SPEED
    this.vz = dz * SPEED
  }

  /** True when something is in the lane just ahead: a person, or the car in front. */
  behind(what: Point, reach: number): boolean {
    const rx = what.x - this.x
    const rz = what.z - this.z
    const along = rx * this.dx + rz * this.dz
    const across = Math.abs(-rx * this.dz + rz * this.dx)
    return along > 0 && along < LENGTH / 2 + reach && across < WIDTH / 2 + 0.5
  }

  /** Where the nose is, so a junction is claimed before the car is in it. */
  get nose(): Point {
    return { x: this.x + this.dx * (LENGTH / 2 + 0.5), z: this.z + this.dz * (LENGTH / 2 + 0.5) }
  }

  /** Brake for anybody or any car in the lane ahead, or a junction somebody else is in, else drive on. */
  drive(seconds: number, blocked: boolean, extent: number): void {
    this.#speed = blocked ? 0 : SPEED
    this.vx = this.dx * this.#speed
    this.vz = this.dz * this.#speed
    this.x = wrap(this.x + this.vx * seconds, extent)
    this.z = wrap(this.z + this.vz * seconds, extent)
  }

  /** How far inside this car's box a point is: positive inside, negative outside (distance to the box). */
  depth(x: number, z: number): number {
    const rx = x - this.x
    const rz = z - this.z
    const along = Math.abs(rx * this.dx + rz * this.dz) - LENGTH / 2
    const across = Math.abs(-rx * this.dz + rz * this.dx) - WIDTH / 2
    if (along <= 0 && across <= 0) return -Math.max(along, across)
    return -Math.hypot(Math.max(along, 0), Math.max(across, 0))
  }
}

function wrap(value: number, extent: number): number {
  return ((value % extent) + extent) % extent
}

/** One crossroads of the test town: the square the two roadways share. */
class Junction {
  readonly x: number
  readonly z: number
  readonly half: number
  constructor(x: number, z: number, half: number) {
    this.x = x
    this.z = z
    this.half = half
  }
  contains(at: Point): boolean {
    return Math.abs(at.x - this.x) <= this.half && Math.abs(at.z - this.z) <= this.half
  }
}

class Roads implements Hazards {
  readonly cars: Car[] = []
  readonly junctions: Junction[] = []
  #scratch: Hazard[] = []
  calls = 0

  /** One frame of traffic: queue behind the car in front, give way at a junction somebody is in, brake for people. */
  drive(seconds: number, people: readonly Point[], extent: number): void {
    const held = new Map<Junction, Car>()
    for (const junction of this.junctions) {
      for (const car of this.cars) if (junction.contains(car)) held.set(junction, car)
    }
    const blocked = this.cars.map((car) => {
      if (people.some((person) => car.behind(person, BRAKE_AHEAD))) return true
      if (this.cars.some((other) => other !== car && car.behind(other, BRAKE_AHEAD))) return true
      const nose = car.nose
      for (const junction of this.junctions) {
        const owner = held.get(junction)
        if (owner && owner !== car && junction.contains(nose) && !junction.contains(car)) return true
      }
      return false
    })
    this.cars.forEach((car, i) => car.drive(seconds, blocked[i]!, extent))
  }

  near(x: number, z: number, radius: number): readonly Hazard[] {
    this.calls++
    const found = this.#scratch
    found.length = 0
    for (const car of this.cars) if (Math.hypot(car.x - x, car.z - z) <= radius) found.push(car)
    return found
  }
}

/** Cars in both lanes of every street of the test town, both axes. */
function fill(cellSize: number, cells: number): Roads {
  const roads = new Roads()
  const extent = cells * cellSize
  const lane = 1.5
  for (let band = 0; band + 3 <= cells; band += 12) {
    for (let other = 0; other + 3 <= cells; other += 12) {
      roads.junctions.push(new Junction((band + 1.5) * cellSize, (other + 1.5) * cellSize, 1.5 * cellSize + 0.5))
    }
  }
  for (let band = 0; band + 3 <= cells; band += 12) {
    const centre = (band + 1.5) * cellSize
    for (let at = 0; at < extent; at += SPACING) {
      // north-south street: right hand traffic, so the lane east of the centre drives south (+z)
      roads.cars.push(new Car(centre + lane, at, 0, 1))
      roads.cars.push(new Car(centre - lane, at + SPACING / 2, 0, -1))
      // east-west street
      roads.cars.push(new Car(at, centre - lane, 1, 0))
      roads.cars.push(new Car(at + SPACING / 2, centre + lane, -1, 0))
    }
  }
  return roads
}

function main(): void {
  const seconds = Number(process.argv[2] ?? 180)
  const seed = process.argv[3] ?? 'dodge-cars'
  const world = testTown()
  const nav = CityNav.from(world)
  const cells = world.grid.width
  const extent = cells * world.cellSize
  const viewer: Point = { x: extent / 2 + world.cellSize * 3.5, z: extent / 2 + world.cellSize * 3.5 }
  const roads = fill(world.cellSize, cells)
  const crowd = Crowd.create({ world, nav, cast: NOBODY, hazards: roads, seed }, { population: 32 })
  const personal = crowd.options.personalSpace

  let inside = 0
  let brushed = 0
  let deepest = 0
  let walkerFrames = 0
  let stoppedCarFrames = 0
  let waiting = 0
  let spent = 0n
  let worst = 0
  const frames = Math.round(seconds / STEP)
  const people: Point[] = []
  for (let frame = 0; frame < frames; frame++) {
    const started = process.hrtime.bigint()
    crowd.update(STEP, viewer)
    const took = process.hrtime.bigint() - started
    spent += took
    worst = Math.max(worst, Number(took) / 1e6)

    people.length = 0
    for (const walker of crowd.walkers()) people.push(walker)
    people.push(viewer)
    roads.drive(STEP, people, extent)

    for (const walker of crowd.walkers()) {
      walkerFrames++
      if (walker.state === 'waiting') waiting++
      for (const car of roads.cars) {
        const depth = car.depth(walker.x, walker.z)
        if (depth > 0) {
          inside++
          deepest = Math.max(deepest, depth)
        } else if (-depth < personal) brushed++
      }
    }
    for (const car of roads.cars) if (car.vx === 0 && car.vz === 0) stoppedCarFrames++
  }

  console.log(`${roads.cars.length} cars, ${crowd.count} walkers, ${frames} frames (${seconds} s), hazards.near called ${roads.calls} times`)
  console.log(`  walker-frames inside a car: ${inside} of ${walkerFrames} (${((100 * inside) / walkerFrames).toFixed(2)}%), deepest ${deepest.toFixed(2)} m`)
  console.log(`  walker-frames within personal space of a car: ${brushed}`)
  console.log(`  walker-frames waiting at a kerb: ${waiting}; car-frames stopped: ${stoppedCarFrames}`)
  console.log(`  crowd update with cars: ${(Number(spent) / 1e3 / frames).toFixed(1)} us mean, worst ${worst.toFixed(3)} ms`)
  console.log(`  ${price(world, nav, seed)}`)
}

/** The same crowd with no cars to look out for, so the cost of looking is the difference. */
function price(world: ReturnType<typeof testTown>, nav: CityNav, seed: string): string {
  const crowd = Crowd.create({ world, nav, cast: NOBODY, seed }, { population: 32 })
  const middle = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
  for (let i = 0; i < 600; i++) crowd.update(STEP, middle)
  const started = process.hrtime.bigint()
  for (let i = 0; i < 3000; i++) crowd.update(STEP, middle)
  return `crowd update with no hazards: ${(Number(process.hrtime.bigint() - started) / 1e3 / 3000).toFixed(1)} us mean`
}

main()
