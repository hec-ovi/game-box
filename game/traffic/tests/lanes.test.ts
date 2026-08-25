import { METRICS, ROAD_KINDS, World, type RoadSegment } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { LaneGraph, Traffic, type Lane, type Point } from '../src/index.ts'
import { SPEED_LIMIT } from '../src/settings.ts'
import { addRoad, lattice } from './city.ts'

const CELL = 2

/** Where the lanes of each class sit, in metres either side of the centreline. */
const LANE_CENTRES: Record<RoadSegment['kind'], readonly number[]> = {
  street: [2.5],
  avenue: [1.75, 5.25],
  exit: [2.25, 6.75],
}

function graphOf(world: World): LaneGraph {
  const built = LaneGraph.build(world.toJSON().roads!, { cellSize: world.cellSize, carLength: METRICS.vehicle.carLength })
  if (!built.ok) throw new Error(JSON.stringify(built.error))
  return built.value
}

/**
 * How far each lane runs from the centreline of its own road, in metres. The
 * lanes of one segment are laid symmetrically about that line, so their own
 * average is where it is, and nothing has to be measured off the grid.
 */
function offCentres(graph: LaneGraph): number[] {
  const bySegment = new Map<string, Lane[]>()
  for (const lane of graph.lanes) {
    const held = bySegment.get(lane.segmentId)
    if (held) held.push(lane)
    else bySegment.set(lane.segmentId, [lane])
  }
  const off: number[] = []
  for (const lanes of bySegment.values()) {
    const across = lanes.map((lane) => acrossOf(lane))
    const middle = across.reduce((sum, one) => sum + one, 0) / across.length
    for (const one of across) off.push(Math.abs(one - middle))
  }
  return off
}

/** Where a lane sits across the road it runs along, in metres. */
function acrossOf(lane: Lane): number {
  const at = lane.path.pointAt(lane.length / 2)
  return Math.abs(lane.direction.x) > 0.5 ? at.z : at.x
}

/**
 * An avenue that turns a corner: three nodes, two segments, four lanes on both.
 * A bend has one road out of it, so it is where the lane rule runs out of a
 * matching lane and has to give a stranded lane somewhere to go.
 */
function bend(): World {
  const cells = METRICS.road.avenue.roadwayCells
  const half = (cells - 1) / 2
  const world = World.create({ name: 'Bend', theme: 'test', seed: 'bend', width: 60, height: 60 })
  world.paint({ x: 0, y: 0, w: 60, h: 60 }, 'building')
  world.paint({ x: 0, y: 40 - half, w: 60, h: cells }, 'street')
  world.paint({ x: 40 - half, y: 0, w: cells, h: 60 }, 'street')
  addRoad(
    world,
    [
      { id: 'node_0001', cell: { x: 5, y: 40 } },
      { id: 'node_0002', cell: { x: 40, y: 40 } },
      { id: 'node_0003', cell: { x: 40, y: 5 } },
    ],
    [
      { id: 'road_0001', from: 'node_0001', to: 'node_0002', kind: 'avenue', lanes: 4 },
      { id: 'road_0002', from: 'node_0002', to: 'node_0003', kind: 'avenue', lanes: 4 },
    ],
  )
  return world
}

describe('lanes', () => {
  it.each(ROAD_KINDS)('lays %s lanes at that class of road’s own width', (kind) => {
    const graph = graphOf(lattice({ across: 3, down: 3, span: 16, kind }))
    const road = METRICS.road[kind]

    for (const lane of graph.lanes) {
      expect(lane.kind).toBe(kind)
      expect(lane.lanes).toBe(road.lanes / 2)
      expect(lane.speedLimit).toBe(SPEED_LIMIT[kind])
    }

    const off = offCentres(graph)
    // every lane is inside the kerbs with room for a car in it
    for (const one of off) expect(one + METRICS.vehicle.carWidth / 2).toBeLessThan((road.roadwayCells * CELL) / 2)
    expect([...new Set(off.map((one) => Number(one.toFixed(3))))].sort((a, b) => a - b)).toEqual(LANE_CENTRES[kind])
  })

  it('keeps every turn inside the junction it crosses, in the lane it belongs in', () => {
    const graph = graphOf(lattice({ across: 3, down: 3, span: 16, kind: 'avenue' }))

    for (const junction of graph.junctions) {
      // the curve never swings out of the square the roadways share
      for (const link of junction.links) {
        for (const point of link.path.points) expect(inside(junction, point)).toBe(true)
      }
    }

    // at a full crossroads every arriving lane has its own lane to turn into
    const crossroads = graph.junctions.filter((one) => new Set(one.exits.map((lane) => lane.segmentId)).size === 4)
    expect(crossroads.length, 'the lattice grew no crossroads, so the rule was never tested').toBeGreaterThan(0)
    let turns = 0
    for (const junction of crossroads) {
      for (const link of junction.links) {
        if (link.turn === 'straight') expect(link.to.lane).toBe(link.from.lane)
        // right out of the kerb lane into the kerb lane, left out of the middle into the middle
        if (link.turn === 'right') expect([link.from.lane, link.to.lane]).toEqual([1, 1])
        if (link.turn === 'left') expect([link.from.lane, link.to.lane]).toEqual([0, 0])
        if (link.turn !== 'straight') turns++
      }
    }
    expect(turns).toBeGreaterThan(0)
  })

  it('leaves no lane arriving at a junction with nowhere to go', () => {
    for (const graph of [graphOf(bend()), graphOf(lattice({ across: 3, down: 3, span: 16, kind: 'avenue' }))]) {
      for (const junction of graph.junctions) {
        for (const entry of junction.entries) {
          // a lane whose only road out is the one it came in on is a dead end, and that is allowed
          if (junction.exits.every((exit) => exit.toNode === entry.fromNode)) continue
          expect(graph.linksFrom(entry).length, `${entry.id} had no way out of ${junction.id}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('drives every lane of an avenue', () => {
    const world = lattice({ across: 4, down: 4, span: 16, kind: 'avenue' })
    const made = Traffic.fromWorld(world, { maxCars: 40, spawnRadius: 300, despawnRadius: 400, minSpawnDistance: 5 })
    if (!made.ok) throw new Error(JSON.stringify(made.error))
    const traffic = made.value
    const focus = { x: 60, z: 60 }
    traffic.populate(focus)

    const byLane = new Map(traffic.graph.lanes.map((lane) => [lane.id, lane]))
    const used = new Set<number>()
    for (let frame = 0; frame < 1200; frame++) {
      traffic.update(1 / 60, focus)
      for (const car of traffic.cars()) {
        const lane = byLane.get(car.trackId)
        if (lane) used.add(lane.lane)
      }
    }
    // both lanes each way, which on a four lane road is all four of them
    expect([...used].sort()).toEqual([0, 1])
  })
})

function inside(junction: { centre: Point; half: number }, point: Point): boolean {
  const slack = 1e-6
  return (
    Math.abs(point.x - junction.centre.x) <= junction.half + slack &&
    Math.abs(point.z - junction.centre.z) <= junction.half + slack
  )
}
