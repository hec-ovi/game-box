import { METRICS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Crowd, type Point, type WalkerView } from '../src/index.ts'
import { FakeCast } from './support/fake-cast.ts'
import { StraightNav } from './support/fake-nav.ts'
import { corridor } from './support/town.ts'
import { Car, Cars } from './support/traffic.ts'

const STEP = 1 / 60
const CELLS = 60
/** The corridor's middle column, where the player stands while the crowd fills in around them. */
const MIDDLE = 20

/**
 * One walker on the pavement of the corridor, walking north across the roadway
 * beside it. The pavement is the only ground the crowd will spawn on, and the
 * two cells sixteen metres from the player are the only ones in the ring, so
 * the walker starts on that row and nowhere else.
 */
function crossing(cars: Cars, road = 1) {
  const world = corridor(CELLS, 'crowd-corridor', road)
  const cell = world.cellSize
  const nav = new StraightNav(cell, 20, { x: 0, y: -1 })
  const viewer: Point = { x: (MIDDLE + 0.5) * cell, z: (road + 1.5) * cell }
  const crowd = Crowd.create(
    { world, nav, cast: new FakeCast(), hazards: cars, seed: 'kerb' },
    { population: 1, retireRadius: 500, spawnNear: 16, spawnFar: 17 },
  )
  // the kerb the walker steps off, and the far side of the roadway it crosses
  return { crowd, viewer, kerb: (road + 1) * cell, across: cell }
}

interface Crossing {
  /** Frames the walker held on the pavement with something coming. */
  readonly waited: number
  /** The frame it was first all the way over the lane, or -1. */
  readonly over: number
  /** The closest a car came while the walker was in the road. */
  readonly closest: number
}

/** `each` runs every frame the walker is alive, counted from the first, so a test can put a car on the road or park it. */
function walkAcross(
  cars: Cars,
  frames: number,
  each?: (walker: WalkerView, frame: number) => void,
  road = 1,
): Crossing {
  const { crowd, viewer, kerb, across } = crossing(cars, road)
  let waited = 0
  let over = -1
  let closest = Infinity
  let seen = 0

  for (let frame = 0; frame < frames; frame++) {
    crowd.update(STEP, viewer)
    cars.drive(STEP)
    const walker = crowd.walkers()[0]
    if (!walker) continue
    each?.(walker, seen)
    seen++
    if (walker.state === 'waiting') waited++
    if (walker.z < across && over === -1) over = seen
    if (walker.z >= kerb) continue
    // in the road: this is where a car being close is a walker being run over
    for (const car of cars.cars) closest = Math.min(closest, Math.hypot(car.x - walker.x, car.z - walker.z))
  }

  return { waited, over, closest }
}

describe('a walker looks before stepping off the kerb', () => {
  it('waits for a car that is coming, then crosses behind it', () => {
    const cars = new Cars()
    const run = walkAcross(cars, 1500, (walker, frame) => {
      // a car a second and a half up the road, in the lane the walker is about to step into
      if (frame === 0) cars.add(new Car({ x: walker.x - 12, z: 3 }, { vx: 8, vz: 0 }))
    })

    expect(run.waited).toBeGreaterThan(30)
    expect(run.over).toBeGreaterThan(0)
    // it was never in the road with the car on top of it
    expect(run.closest).toBeGreaterThan(cars.cars[0]!.radius)
  })

  it('crosses without pausing when the road is empty, and gets there sooner', () => {
    const empty = walkAcross(new Cars(), 1500)
    const cars = new Cars()
    const held = walkAcross(cars, 1500, (walker, frame) => {
      if (frame === 0) cars.add(new Car({ x: walker.x - 12, z: 3 }, { vx: 8, vz: 0 }))
    })

    expect(empty.waited).toBe(0)
    expect(empty.over).toBeGreaterThan(0)
    // the same walker, the same route: the one that waited got over later
    expect(empty.over).toBeLessThan(held.over)
  })

  it('waits for a car in the oncoming half of a wide road, which it is in for most of the crossing', () => {
    const road = METRICS.road.avenue.roadwayCells
    const cell = 2
    // the outer oncoming lane of a 14 m avenue, twelve metres from the kerb the
    // walker steps off: nothing a look at the kerb alone would ever notice
    const middle = cell * (1 + road / 2)
    const lane = middle - 1.5 * ((road * cell) / METRICS.road.avenue.lanes)
    const cars = new Cars()
    const run = walkAcross(
      cars,
      3000,
      (walker, frame) => {
        // an avenue's speed limit is 13.9 m/s, so this one arrives in about nine seconds
        if (frame === 0) cars.add(new Car({ x: walker.x - 120, z: lane }, { vx: 13.9, vz: 0 }))
      },
      road,
    )

    // it held on the kerb until it could be out of that lane in time
    expect(run.waited).toBeGreaterThan(60)
    expect(run.over).toBeGreaterThan(0)
    expect(run.closest).toBeGreaterThan(cars.cars[0]!.radius)
  })

  it('is not stranded by a car that has stopped in the road', () => {
    const cars = new Cars()
    const run = walkAcross(cars, 1500, (walker, frame) => {
      // a car coming, which the walker waits for, and which then parks square across its way
      if (frame === 0) cars.add(new Car({ x: walker.x - 12, z: 3 }, { vx: 8, vz: 0 }))
      if (frame === 60) {
        cars.cars[0]!.x = walker.x
        cars.cars[0]!.stop()
      }
    })

    // it held while the car was coming, and went as soon as the thing was standing still
    expect(run.waited).toBeGreaterThan(0)
    expect(run.over).toBeGreaterThan(0)
    expect(run.over).toBeLessThan(300)
  })
})
