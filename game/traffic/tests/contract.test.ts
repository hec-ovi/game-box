import { METRICS, ROAD_KINDS, World } from '@gb/world'
import { Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { Traffic, type CarBodies, type CarBody, type CarSpawn, type CarView } from '../src/index.ts'
import { lattice } from './city.ts'

const CAR_LENGTH = METRICS.vehicle.carLength
const HALF_WIDTH = METRICS.vehicle.carWidth / 2

function open(world: World, options = {}) {
  const made = Traffic.fromWorld(world, { spawnRadius: 300, despawnRadius: 400, minSpawnDistance: 5, ...options })
  if (!made.ok) throw new Error(JSON.stringify(made.error))
  return made.value
}

function corners(car: CarView): Array<{ x: number; z: number }> {
  const nose = { x: Math.sin(car.heading), z: Math.cos(car.heading) }
  const side = { x: -nose.z, z: nose.x }
  const points = []
  for (const along of [CAR_LENGTH / 2, -CAR_LENGTH / 2]) {
    for (const across of [HALF_WIDTH, -HALF_WIDTH]) {
      points.push({ x: car.x + nose.x * along + side.x * across, z: car.z + nose.z * along + side.z * across })
    }
  }
  return points
}

/**
 * One car driven until the road under it runs out, with the player following it
 * so it is never out of sight. Answers where it ended up.
 */
function drive(world: World) {
  const traffic = open(world, { maxCars: 1 })
  const town = { x: 40, z: 10 }
  traffic.populate(town)
  const first = traffic.cars()[0]
  if (!first) throw new Error('no car spawned')
  let watch = { x: first.x, z: first.z }
  for (let frame = 0; frame < 3000; frame++) {
    traffic.update(1 / 60, watch)
    const car = traffic.cars().find((other) => other.id === first.id)
    if (!car) break
    watch = { x: car.x, z: car.z }
  }
  const car = traffic.cars().find((other) => other.id === first.id)
  const cell = (v: number) => Math.floor(v / world.cellSize)
  return {
    traffic,
    car,
    watch,
    beyond: car ? world.grid.at(cell(car.x), cell(car.z)) === undefined : false,
    cell: car ? world.grid.at(cell(car.x), cell(car.z)) : undefined,
  }
}

describe('Traffic', () => {
  it('refuses a city it cannot drive', () => {
    const roadless = World.create({ name: 'Nowhere', theme: 'test', seed: 's', width: 20, height: 20 })
    expect(Traffic.fromWorld(roadless)).toEqual({ ok: false, error: { code: 'no-lanes', message: expect.any(String) } })

    const dangling = World.create({ name: 'Nowhere', theme: 'test', seed: 's', width: 20, height: 20 })
    dangling.addRoad(
      [{ id: 'node_0001', cell: { x: 4, y: 4 } }],
      [{ id: 'road_0001', from: 'node_0001', to: 'node_0002', kind: 'street', lanes: 2 }],
    )
    const broken = Traffic.fromWorld(dangling)
    expect(broken.ok).toBe(false)
    if (!broken.ok) expect(broken.error.code).toBe('broken-graph')
  })

  it.each(ROAD_KINDS)('keeps every car on a %s and out of the buildings', (kind) => {
    const world = lattice({ across: 4, down: 4, span: 13, kind })
    const traffic = open(world, { maxCars: 24 })
    const focus = { x: 40, z: 40 }
    traffic.populate(focus)

    const cell = (v: number) => Math.floor(v / world.cellSize)
    for (let frame = 0; frame < 1200; frame++) {
      traffic.update(1 / 60, focus)
      for (const car of traffic.cars()) {
        expect(world.grid.at(cell(car.x), cell(car.z))).toBe('street')
        for (const corner of corners(car)) {
          expect(world.grid.at(cell(corner.x), cell(corner.z))).not.toBe('building')
        }
      }
    }
    expect(traffic.count).toBeGreaterThan(0)
  })

  it('slows behind the car in front instead of driving through it', () => {
    const world = lattice({ across: 4, down: 4, span: 13 })
    const traffic = open(world, { maxCars: 24 })
    const focus = { x: 40, z: 40 }
    traffic.populate(focus)

    let closest = Number.POSITIVE_INFINITY
    let slowest = Number.POSITIVE_INFINITY
    for (let frame = 0; frame < 1200; frame++) {
      traffic.update(1 / 60, focus)
      const byTrack = new Map<string, CarView[]>()
      for (const car of traffic.cars()) {
        const group = byTrack.get(car.trackId)
        if (group) group.push(car)
        else byTrack.set(car.trackId, [car])
        slowest = Math.min(slowest, car.speed)
      }
      for (const group of byTrack.values()) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            closest = Math.min(closest, Math.hypot(group[i]!.x - group[j]!.x, group[i]!.z - group[j]!.z))
          }
        }
      }
    }
    expect(closest).toBeGreaterThanOrEqual(CAR_LENGTH)
    expect(closest).toBeLessThan(12) // they really did queue up, so the gap means something
    expect(slowest).toBeLessThan(2) // and somebody had to give way
  })

  it('lets one car through a junction at a time', () => {
    const world = lattice({ across: 4, down: 4, span: 13 })
    const traffic = open(world, { maxCars: 24 })
    const focus = { x: 40, z: 40 }
    traffic.populate(focus)

    let crossings = 0
    for (let frame = 0; frame < 1200; frame++) {
      traffic.update(1 / 60, focus)
      for (const junction of traffic.graph.junctions) {
        const inside = traffic.cars().filter(
          (car) =>
            Math.abs(car.x - junction.centre.x) < junction.half && Math.abs(car.z - junction.centre.z) < junction.half,
        )
        expect(inside.length).toBeLessThanOrEqual(1)
        crossings += inside.length
      }
    }
    expect(crossings).toBeGreaterThan(0)
  })

  it('runs a car off the map at the end of the road out of town, and off no other dead end', () => {
    const outOfTown = drive(lattice({ across: 2, down: 1, span: 40, kind: 'exit' }))
    const deadEnd = drive(lattice({ across: 2, down: 1, span: 40 }))

    // the exit road carries on past the last junction and off the edge of the map
    expect(outOfTown.car).toBeDefined()
    expect(outOfTown.beyond, 'the road out stopped inside the map').toBe(true)

    // any other dead end is a dead end: the car stops on the road it is on
    expect(deadEnd.car).toBeDefined()
    expect(deadEnd.beyond, 'a car left the city off a street').toBe(false)
    expect(deadEnd.cell, 'a car left the roadway').toBe('street')
  })

  it('takes a car that has run out of road only once the player cannot see it go', () => {
    const world = lattice({ across: 2, down: 1, span: 40, kind: 'exit' })
    const { traffic, car, watch } = drive(world)
    expect(car, 'a car was taken away in front of the player').toBeDefined()

    // twelve seconds standing still, still watched: it stays
    for (let frame = 0; frame < 900; frame++) traffic.update(1 / 60, watch)
    expect(traffic.cars().some((other) => other.id === car!.id)).toBe(true)

    // the player turns back into town, and only then is it taken off the road
    const town = { x: 40, z: 10 }
    for (let frame = 0; frame < 900; frame++) traffic.update(1 / 60, town)
    expect(traffic.cars().some((other) => other.id === car!.id)).toBe(false)
  })

  it('gives the same traffic for the same seed, and different traffic for another', () => {
    const drive = (seed: string) => {
      const traffic = open(lattice({ across: 4, down: 4, span: 13 }), { maxCars: 20, seed })
      const focus = { x: 40, z: 40 }
      traffic.populate(focus)
      for (let frame = 0; frame < 900; frame++) traffic.update(1 / 60, focus)
      return traffic.cars().map((car) => `${car.id} ${car.model} ${car.x.toFixed(4)} ${car.z.toFixed(4)}`)
    }
    expect(drive('same')).toEqual(drive('same'))
    expect(drive('same')).not.toEqual(drive('other'))
  })

  it('drives three.js objects and hands them back when a car retires', () => {
    const live = new Map<string, CarBody>()
    let released = 0
    const bodies: CarBodies = {
      acquire(spawn: CarSpawn) {
        const object = new Object3D()
        live.set(spawn.id, object)
        return object
      },
      release(_body: CarBody, spawn: CarSpawn) {
        live.delete(spawn.id)
        released++
      },
    }
    const traffic = open(lattice({ across: 2, down: 1, span: 40 }), { maxCars: 1, bodies, rideHeight: 0.2 })
    traffic.populate({ x: 40, z: 10 })
    for (let frame = 0; frame < 600; frame++) traffic.update(1 / 60, { x: 40, z: 10 })

    for (const car of traffic.cars()) {
      const object = live.get(car.id)!
      expect(object.position.x).toBeCloseTo(car.x, 6)
      expect(object.position.z).toBeCloseTo(car.z, 6)
      expect(object.position.y).toBe(0.2)
      expect(object.rotation.y).toBeCloseTo(car.heading, 6)
    }
    // walk out of the neighbourhood: what was driving in it is handed back
    const away = { x: 40, z: 900 }
    for (let frame = 0; frame < 600; frame++) traffic.update(1 / 60, away)
    expect(released).toBeGreaterThan(0)
    expect(live.size).toBe(traffic.count)
  })

  it('hands a car over to somebody else, and never touches it again', () => {
    const live = new Map<string, Object3D>()
    const bodies: CarBodies = {
      acquire(spawn: CarSpawn) {
        const object = new Object3D()
        live.set(spawn.id, object)
        return object
      },
      release(_body: CarBody, spawn: CarSpawn) {
        live.delete(spawn.id)
      },
    }
    const traffic = open(lattice({ across: 3, down: 3, span: 20 }), { maxCars: 6, bodies })
    traffic.populate({ x: 40, z: 40 })
    for (let frame = 0; frame < 120; frame++) traffic.update(1 / 60, { x: 40, z: 40 })

    const taking = traffic.cars()[0]!
    const was = { id: taking.id, x: taking.x, z: taking.z, heading: taking.heading, model: taking.model }
    const given = traffic.handOver(was.id)

    expect(given).toEqual({ ...was, speed: expect.any(Number) })
    expect(traffic.cars().some((car) => car.id === was.id)).toBe(false)
    // the body went back to the pool, so whoever took the car draws their own
    expect(live.has(was.id)).toBe(false)
    // and nothing on the road is still queued behind it
    for (const lane of traffic.graph.lanes) {
      expect(lane.cars.some((car) => car.id === was.id)).toBe(false)
    }

    for (let frame = 0; frame < 600; frame++) traffic.update(1 / 60, { x: 40, z: 40 })
    expect(traffic.count).toBeGreaterThan(0)
    expect(live.size).toBe(traffic.count)

    expect(traffic.handOver(was.id)).toBeUndefined()
    expect(traffic.handOver('nobody')).toBeUndefined()
  })

  it('gives back the junction a car was crossing when it is taken mid-turn', () => {
    const traffic = open(lattice({ across: 3, down: 3, span: 16 }), { maxCars: 8 })
    const focus = { x: 60, z: 60 }
    traffic.populate(focus)

    const crossing = new Map<string, string>()
    for (const junction of traffic.graph.junctions) {
      for (const link of junction.links) crossing.set(link.id, junction.id)
    }

    let taken: { id: string; junctionId: string } | undefined
    for (let frame = 0; frame < 6000 && !taken; frame++) {
      traffic.update(1 / 60, focus)
      const inside = traffic.cars().find((car) => crossing.has(car.trackId))
      if (inside) taken = { id: inside.id, junctionId: crossing.get(inside.trackId)! }
    }
    if (!taken) throw new Error('nobody ever reached a junction')

    expect(traffic.handOver(taken.id)).toBeDefined()
    for (const junction of traffic.graph.junctions) {
      for (const link of junction.links) expect(link.cars.some((car) => car.id === taken!.id)).toBe(false)
    }

    // the junction is free again: somebody else drives across it
    let crossed = false
    for (let frame = 0; frame < 6000 && !crossed; frame++) {
      traffic.update(1 / 60, focus)
      crossed = traffic.cars().some((car) => crossing.get(car.trackId) === taken!.junctionId)
    }
    expect(crossed).toBe(true)
  })
})
