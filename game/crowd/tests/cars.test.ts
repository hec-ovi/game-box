import { METRICS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Crowd, type Point, type WalkerView } from '../src/index.ts'
import { FakeCast } from './support/fake-cast.ts'
import { StraightNav } from './support/fake-nav.ts'
import { corridor } from './support/town.ts'
import { CAR, Car, Cars } from './support/traffic.ts'

const STEP = 1 / 60
const CELLS = 60
const MIDDLE = 20
/** Three cells of roadway either side of the pavement: room for a car to stand across somebody's way. */
const ROAD = 3
/** A car lying along the corridor, across the way of somebody crossing it. */
const ALONG = -Math.PI / 2

/**
 * One walker on the corridor's pavement, walking north over the roadway, with
 * the road as the test lays it. The player stands well off, so nothing here is
 * about them.
 */
function crossing(cars: Cars) {
  const world = corridor(CELLS, 'crowd-corridor', ROAD)
  const cell = world.cellSize
  const nav = new StraightNav(cell, 20, { x: 0, y: -1 })
  const viewer: Point = { x: (MIDDLE + 0.5) * cell, z: (ROAD + 1.5) * cell }
  const crowd = Crowd.create(
    { world, nav, cast: new FakeCast(), hazards: cars, seed: 'solid' },
    { population: 1, retireRadius: 500, spawnNear: 16, spawnFar: 17 },
  )
  crowd.update(STEP, viewer)
  const walker = crowd.walkers()[0]
  if (!walker) throw new Error('nobody came out to cross')
  return { crowd, viewer, walker, cell }
}

/** How far inside a car lying along the corridor a point is: positive inside, else minus the distance to it. */
function depth(car: Car, at: Point): number {
  const along = Math.abs(at.x - car.x) - CAR.length / 2
  const across = Math.abs(at.z - car.z) - CAR.width / 2
  if (along <= 0 && across <= 0) return -Math.max(along, across)
  return -Math.hypot(Math.max(along, 0), Math.max(across, 0))
}

describe('a car is solid to a walker', () => {
  it('walks round one stopped across its way, never through it and never closer than arm\'s length', () => {
    const cars = new Cars()
    const { crowd, viewer, walker, cell } = crossing(cars)
    // parked square across the crossing, in the middle of the roadway they are about to cross
    const car = cars.add(new Car({ x: walker.x, z: 2.5 * cell }, { vx: 0, vz: 0 }, CAR.length / 2, ALONG))

    let over = -1
    let deepest = -Infinity
    let widest = 0
    for (let frame = 0; frame < 1500 && over < 0; frame++) {
      crowd.update(STEP, viewer)
      const now = crowd.walkers()[0]!
      deepest = Math.max(deepest, depth(car, now))
      widest = Math.max(widest, Math.abs(now.x - walker.x))
      if (now.z < cell) over = frame
    }

    expect(over).toBeGreaterThan(0)
    expect(deepest).toBeLessThanOrEqual(-crowd.options.personalSpace + 1e-9)
    // round it, which is further than its own half length
    expect(widest).toBeGreaterThan(CAR.length / 2)
  })

  it('is shoved out of one that has arrived on top of it, at a shove\'s pace and onto open ground', () => {
    const cars = new Cars()
    const { crowd, viewer, walker } = crossing(cars)
    // stood still, talking to somebody, when a car stops right over them
    const hold = crowd.attend(walker.id, walker.x, 1.7, walker.z - 2)
    crowd.update(STEP, viewer)
    const stood = crowd.walkers()[0]!
    const car = cars.add(new Car({ x: stood.x, z: stood.z }, { vx: 0, vz: 0 }, CAR.length / 2, ALONG))
    expect(depth(car, stood)).toBeGreaterThan(0)

    let out = -1
    let longest = 0
    let before: WalkerView = stood
    for (let frame = 0; frame < 120 && out < 0; frame++) {
      crowd.update(STEP, viewer)
      const now = crowd.walkers()[0]!
      longest = Math.max(longest, Math.hypot(now.x - before.x, now.z - before.z))
      before = now
      if (depth(car, now) <= 0) out = frame
    }

    // out inside a second, without a jump anybody would see, and the conversation still on
    expect(out).toBeGreaterThanOrEqual(0)
    expect(out).toBeLessThan(60)
    expect(longest).toBeLessThan(METRICS.player.runSpeed * STEP)
    expect(hold.held).toBe(true)
    expect(before.state).toBe('idle')
  })
})
