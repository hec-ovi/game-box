import { METRICS, World } from '@gb/world'
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

  it('keeps every car on the roadway and out of the buildings', () => {
    const world = lattice({ across: 4, down: 4, span: 13 })
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

  it('retires a car that drives off the end of the graph', () => {
    const world = lattice({ across: 2, down: 1, span: 40 })
    const traffic = open(world, { maxCars: 1 })
    traffic.populate({ x: 40, z: 10 })
    const first = traffic.cars()[0]
    expect(first).toBeDefined()

    for (let frame = 0; frame < 3000; frame++) traffic.update(1 / 60, { x: 40, z: 10 })
    expect(traffic.cars().some((car) => car.id === first!.id)).toBe(false)
    expect(traffic.count).toBeLessThanOrEqual(1)
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
    for (let frame = 0; frame < 2400; frame++) traffic.update(1 / 60, { x: 40, z: 10 })
    expect(released).toBeGreaterThan(0)
    expect(live.size).toBe(traffic.count)
  })
})
