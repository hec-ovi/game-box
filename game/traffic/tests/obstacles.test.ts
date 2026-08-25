import { METRICS, World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { CITY_DRIVING } from '../src/idm.ts'
import { Traffic, type Obstacle, type Obstacles } from '../src/index.ts'
import { lattice } from './city.ts'
import { clearance, relative, Walker } from './walker.ts'

const CAR_LENGTH = METRICS.vehicle.carLength
const STEP = 1 / 60

/** Whoever is in the road this frame. The app fills this from the crowd; a test fills it by hand. */
class People implements Obstacles {
  spots: Obstacle[] = []

  near(): readonly Obstacle[] {
    return this.spots
  }
}

function open(world: World, options = {}) {
  const made = Traffic.fromWorld(world, { spawnRadius: 300, despawnRadius: 400, minSpawnDistance: 5, ...options })
  if (!made.ok) throw new Error(JSON.stringify(made.error))
  return made.value
}

/** One car on a long straight street, with room in front of it, and the people it can see. */
function street(options = {}) {
  const people = new People()
  const traffic = open(lattice({ across: 2, down: 1, span: 120, seed: 'brakes' }), {
    maxCars: 1,
    obstacles: people,
    ...options,
  })
  traffic.populate({ x: 40, z: 20 })
  const car = traffic.cars()[0]
  if (!car) throw new Error('no car spawned')
  const lane = traffic.graph.lanes.find((l) => l.id === car.trackId)!
  const from = lane.path.nearestTo(car).s
  return { traffic, people, car, lane, from, room: lane.length - from }
}

describe('somebody in the road', () => {
  it('is braked for, and stopped short of, rather than driven through', () => {
    const { traffic, people, car, lane, from } = street()
    const ahead = 45
    expect(lane.length - from, 'the test needs room to brake in').toBeGreaterThan(ahead + 10)
    people.spots = [lane.path.pointAt(from + ahead)]

    const speeds: number[] = [car.speed]
    let closest = Number.POSITIVE_INFINITY
    for (let frame = 0; frame < 900; frame++) {
      traffic.update(STEP, { x: car.x, z: car.z })
      closest = Math.min(closest, relative(car, people.spots[0]!).along)
      speeds.push(car.speed)
    }

    // it never reached the person, let alone drove through them
    expect(closest).toBeGreaterThan(CAR_LENGTH / 2)
    expect(car.speed).toBeLessThan(0.05)
    expect(speeds[0]).toBeGreaterThan(5)

    // and it braked like a car: no frame harder than the model allows, over a plausible distance
    const hardest = Math.max(...speeds.slice(1).map((v, i) => (speeds[i]! - v) / STEP))
    expect(hardest).toBeLessThanOrEqual(CITY_DRIVING.maxBrake + 1e-9)
    const braking = speeds.filter((v, i) => i > 0 && v < speeds[i - 1]!).length
    expect(braking * STEP, 'stopped dead instead of slowing down').toBeGreaterThan(2)
  })

  it('is stopped at, not driven past, when they step out too close to brake for', () => {
    const { traffic, people, car, lane } = street()
    for (let frame = 0; frame < 120; frame++) traffic.update(STEP, { x: car.x, z: car.z })
    expect(car.speed, 'the test needs a car at speed').toBeGreaterThan(5)

    // somebody steps off the kerb closer than any brakes stop a car from here,
    // which is what the player does. Driving through them is not the answer
    const at = lane.path.nearestTo(car).s
    const gap = 5 - CAR_LENGTH / 2 - 0.5
    expect(gap, 'the test needs them inside the braking distance').toBeLessThan(car.speed ** 2 / (2 * CITY_DRIVING.maxBrake))
    people.spots = [lane.path.pointAt(at + 5)]

    let closest = Number.POSITIVE_INFINITY
    for (let frame = 0; frame < 300; frame++) {
      traffic.update(STEP, { x: car.x, z: car.z })
      closest = Math.min(closest, relative(car, people.spots[0]!).along)
    }
    // nose to the person's near edge: the half metre it keeps, exactly
    expect(closest - CAR_LENGTH / 2 - 0.5).toBeCloseTo(0.5, 6)
    expect(car.speed).toBeLessThan(0.05)
  })

  it('is never driven onto, nose, flank or tail, over a walk through the traffic', () => {
    const walker = new Walker('a', { x: 40, z: 40 })
    const traffic = open(lattice({ across: 4, down: 4, span: 13, seed: 'a' }), { maxCars: 24, seed: 'a', obstacles: walker })
    walker.roam(traffic.graph.lanes)
    traffic.populate(walker)

    const was = new Map<string, { x: number; z: number }>()
    let overlaps = 0
    let closestAhead = Number.POSITIVE_INFINITY
    let stops = 0
    for (let frame = 0; frame < 10800; frame++) {
      walker.step(STEP, traffic.cars())
      was.clear()
      for (const car of traffic.cars()) was.set(car.id, { x: car.x, z: car.z })
      traffic.update(STEP, walker)
      for (const car of traffic.cars()) {
        if (clearance(car, walker) < walker.radius) overlaps++
        if (car.speed < 0.01 && clearance(car, walker) < 3) stops++
        const before = was.get(car.id)
        const moved = before !== undefined && (car.x !== before.x || car.z !== before.z)
        const { along, across } = relative(car, walker)
        // a car that moved with the walker squarely in front of it kept its half metre
        if (moved && along > CAR_LENGTH / 2 && Math.abs(across) <= METRICS.vehicle.carWidth / 2) {
          closestAhead = Math.min(closestAhead, along - CAR_LENGTH / 2 - walker.radius)
        }
      }
    }
    expect(stops, 'no car ever stopped for the walker, so the walk proves nothing').toBeGreaterThan(0)
    expect(overlaps, 'frames with a car on the walker').toBe(0)
    expect(closestAhead).toBeGreaterThanOrEqual(0.5 - 1e-9)
  })

  it('is driven around the moment they step back onto the pavement', () => {
    const { traffic, people, car, lane, from } = street()
    people.spots = [lane.path.pointAt(from + 45)]
    for (let frame = 0; frame < 900; frame++) traffic.update(STEP, { x: car.x, z: car.z })
    const waiting = { x: car.x, z: car.z }
    expect(car.speed).toBeLessThan(0.05)

    people.spots = []
    for (let frame = 0; frame < 600; frame++) traffic.update(STEP, { x: car.x, z: car.z })
    expect(car.speed).toBeGreaterThan(4)
    expect(relative(car, waiting).along, 'never moved off').toBeLessThan(-20)
  })

  it('is ignored when they are in the lane going the other way', () => {
    const { traffic, people, car, lane, from } = street()
    const on = lane.path.pointAt(from + 45)
    const side = { x: -Math.cos(car.heading), z: Math.sin(car.heading) }
    // the oncoming lane centre: a whole lane to our left, on a street's two lanes
    const oncoming = (METRICS.road.street.roadwayCells * 2) / METRICS.road.street.lanes
    people.spots = [{ x: on.x - side.x * oncoming, z: on.z - side.z * oncoming }]

    const start = { x: car.x, z: car.z }
    let slowest = Number.POSITIVE_INFINITY
    for (let frame = 0; frame < 600; frame++) {
      traffic.update(STEP, { x: car.x, z: car.z })
      slowest = Math.min(slowest, car.speed)
    }
    expect(slowest).toBeGreaterThan(4)
    expect(relative(car, start).along).toBeLessThan(-45)
  })

  it('keeps cars out of a junction they would have to stop inside', () => {
    const people = new People()
    const traffic = open(lattice({ across: 3, down: 3, span: 13 }), { maxCars: 16, obstacles: people })
    const focus = { x: 40, z: 40 }
    const junction = traffic.graph.junctions.find((one) => one.exits.length >= 3 && one.entries.length >= 3)!
    // somebody in the mouth of every road out: a car that took this junction
    // would stop inside it and hold it against everybody
    people.spots = junction.exits.map((lane) => lane.path.pointAt(5))
    traffic.populate(focus)

    let inside = 0
    let waiting = 0
    for (let frame = 0; frame < 1800; frame++) {
      traffic.update(STEP, focus)
      for (const car of traffic.cars()) {
        if (junction.contains(car)) inside++
        else if (car.speed < 0.1 && Math.hypot(car.x - junction.centre.x, car.z - junction.centre.z) < junction.half + 12) waiting++
      }
    }
    expect(waiting, 'no car ever came to this junction, so the test proves nothing').toBeGreaterThan(0)
    expect(inside, 'a car drove into a junction it could not leave').toBe(0)
  })

  it('keeps cars out of a junction somebody is standing in the middle of', () => {
    const people = new People()
    const traffic = open(lattice({ across: 3, down: 3, span: 13 }), { maxCars: 16, obstacles: people })
    const junction = traffic.graph.junctions.find((one) => one.exits.length >= 3 && one.entries.length >= 3)!
    // out in the middle of the square rather than in the mouth of a road out: a
    // car that drives in stops on top of them and holds the junction against
    // every other arm for as long as they stand there
    people.spots = [junction.centre]
    traffic.populate(junction.centre)

    let parked = 0
    let waiting = 0
    for (let frame = 0; frame < 1800; frame++) {
      traffic.update(STEP, junction.centre)
      for (const car of traffic.cars()) {
        if (junction.contains(car)) {
          if (car.speed < 0.1) parked++
        } else if (car.speed < 0.1 && Math.hypot(car.x - junction.centre.x, car.z - junction.centre.z) < junction.half + 12) {
          waiting++
        }
      }
    }
    expect(waiting, 'no car ever came to this junction, so the test proves nothing').toBeGreaterThan(0)
    expect(parked, 'a car stopped inside a junction it could not get out of').toBe(0)
  })

  it('does not gridlock a city with people scattered over it', () => {
    const people = new People()
    const traffic = open(lattice({ across: 4, down: 4, span: 13 }), { maxCars: 24, obstacles: people })
    const focus = { x: 40, z: 40 }
    // out in the middle of the road, and in the mouth of a lane leaving a junction
    people.spots = traffic.graph.lanes
      .filter((_, i) => i % 5 === 0)
      .map((lane, i) => lane.path.pointAt(i % 2 === 0 ? lane.length / 2 : 1))
    traffic.populate(focus)

    let closest = Number.POSITIVE_INFINITY
    for (let frame = 0; frame < 1200; frame++) {
      traffic.update(STEP, focus)
      for (const car of traffic.cars()) {
        expect(Number.isFinite(car.x) && Number.isFinite(car.z) && Number.isFinite(car.speed)).toBe(true)
        for (const person of people.spots) closest = Math.min(closest, Math.hypot(car.x - person.x, car.z - person.z))
      }
    }
    // the far side of the road is 3 m away, so passing is fine; driving over somebody is not
    expect(closest, 'a car went over somebody').toBeGreaterThan(CAR_LENGTH / 2)

    // the city is still driving: over the last two seconds, cars covered ground
    const before = traffic.cars().map((car) => ({ id: car.id, x: car.x, z: car.z }))
    for (let frame = 0; frame < 120; frame++) traffic.update(STEP, focus)
    const moved = traffic.cars().filter((car) => {
      const was = before.find((one) => one.id === car.id)
      return !was || Math.hypot(car.x - was.x, car.z - was.z) > 1
    })
    expect(traffic.count).toBeGreaterThan(0)
    expect(moved.length, 'the whole city seized up').toBeGreaterThan(0)
  })
})
