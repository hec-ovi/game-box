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
 * One walker on the pavement of the corridor, walking north across the lane
 * beside it. The two cells sixteen metres from the player are the only ones in
 * the spawn ring, so the walker starts on the row and nowhere else.
 */
function crossing(cars: Cars) {
  const world = corridor(CELLS)
  const nav = new StraightNav(world.cellSize, 20, { x: 0, y: -1 })
  const viewer: Point = { x: (MIDDLE + 0.5) * world.cellSize, z: 5 }
  const crowd = Crowd.create(
    { world, nav, cast: new FakeCast(), hazards: cars, seed: 'kerb' },
    { population: 1, retireRadius: 500, spawnNear: 16, spawnFar: 17 },
  )
  // the kerb the walker steps off, and the far side of the lane it crosses
  return { crowd, viewer, kerb: 2 * world.cellSize, across: world.cellSize }
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
function walkAcross(cars: Cars, frames: number, each?: (walker: WalkerView, frame: number) => void): Crossing {
  const { crowd, viewer, kerb, across } = crossing(cars)
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
