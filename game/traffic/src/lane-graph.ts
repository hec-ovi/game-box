import { cellCentre, type RoadNode, type RoadSegment } from '@gb/world'
import { err, ok, type Result } from '@gb/kit'
import type { TrafficError } from './errors.ts'
import { direction, distance, offsetBy, Path, rightOf, tangentCrossing, type Point } from './geometry.ts'
import { RoadClass } from './road-class.ts'
import { Junction, Lane, Link, type Turn } from './track.ts'
import { TURN_SPEED } from './settings.ts'

export interface Roads {
  readonly nodes: readonly RoadNode[]
  readonly segments: readonly RoadSegment[]
}

export interface GraphShape {
  /** Metres per grid cell, from the world. */
  readonly cellSize: number
  /** How long a car is, so a lane too short to hold one is not offered. */
  readonly carLength: number
}

const CURVE_STEPS = 8

/**
 * The road graph as something you can drive: every lane of every segment, laid
 * out to the right of its centre line, plus the way across every junction.
 *
 * Width and lanes are the segment's own class, from `RoadClass`, so a street
 * carries one lane each way and an avenue two. A junction is as wide as the
 * widest arm meeting there, which is how the city paints it.
 */
export class LaneGraph {
  readonly lanes: readonly Lane[]
  readonly junctions: readonly Junction[]
  readonly #links = new Map<string, Link[]>()

  private constructor(lanes: readonly Lane[], junctions: readonly Junction[]) {
    this.lanes = lanes
    this.junctions = junctions
    for (const junction of junctions) {
      for (const link of junction.links) {
        const list = this.#links.get(link.from.id)
        if (list) list.push(link)
        else this.#links.set(link.from.id, [link])
      }
    }
  }

  /** Every way out of the junction this lane ends at. Empty means a dead end. */
  linksFrom(lane: Lane): readonly Link[] {
    return this.#links.get(lane.id) ?? []
  }

  static build(roads: Roads, shape: GraphShape): Result<LaneGraph, TrafficError> {
    const centres = new Map<string, Point>()
    for (const node of roads.nodes) {
      centres.set(node.id, cellCentre(node.cell.x, node.cell.y, shape.cellSize))
    }

    const classes = roads.segments.map((segment) => new RoadClass(segment, shape.cellSize))
    const halves = junctionHalves(roads.segments, classes)
    const lanes: Lane[] = []
    const junctions = new Map<string, Junction>()
    for (const [id, centre] of centres) junctions.set(id, new Junction(id, centre, halves.get(id) ?? 0))

    for (const [index, segment] of roads.segments.entries()) {
      const a = centres.get(segment.from)
      const b = centres.get(segment.to)
      if (!a || !b) {
        return err({ code: 'broken-graph', message: `segment ${segment.id} points at a node that is not there` })
      }
      const road = classes[index]!
      const halfA = halves.get(segment.from)!
      const halfB = halves.get(segment.to)!
      if (distance(a, b) <= halfA + halfB) continue // the junctions already overlap: no lane fits
      for (let lane = 0; lane < road.perWay; lane++) {
        lanes.push(cut(`${segment.id}_f${lane}`, segment, road, lane, a, b, segment.from, segment.to, halfA, halfB))
        lanes.push(cut(`${segment.id}_b${lane}`, segment, road, lane, b, a, segment.to, segment.from, halfB, halfA))
      }
    }

    const usable = lanes.filter((lane) => lane.length > shape.carLength)
    if (usable.length === 0) {
      return err({ code: 'no-lanes', message: 'no road segment is long enough to drive on' })
    }
    for (const lane of usable) {
      junctions.get(lane.fromNode)?.exits.push(lane)
      junctions.get(lane.toNode)?.entries.push(lane)
    }
    for (const junction of junctions.values()) link(junction)

    return ok(new LaneGraph(usable, [...junctions.values()]))
  }
}

/**
 * How much roadway each node keeps clear for the cars crossing it: half the
 * widest road meeting there, so the junction is as wide as its widest arm and
 * the roadway runs right through.
 *
 * A node with one road on it is not a junction, it is where the road stops, so
 * nothing is kept clear and the lane runs right up to it. That is what lets the
 * road out of the valley be driven: its last stretch is a short stub between
 * the edge of town and the edge of the map, and two junction squares would eat
 * the whole of it.
 */
function junctionHalves(segments: readonly RoadSegment[], classes: readonly RoadClass[]): Map<string, number> {
  const widest = new Map<string, number>()
  const arms = new Map<string, number>()
  for (const [index, segment] of segments.entries()) {
    const half = classes[index]!.roadway / 2
    for (const node of [segment.from, segment.to]) {
      widest.set(node, Math.max(widest.get(node) ?? 0, half))
      arms.set(node, (arms.get(node) ?? 0) + 1)
    }
  }
  const halves = new Map<string, number>()
  for (const [node, half] of widest) halves.set(node, (arms.get(node) ?? 0) > 1 ? half : 0)
  return halves
}

/** One lane of one direction of a segment, stopped short of the junction at each end. */
function cut(
  id: string,
  segment: RoadSegment,
  road: RoadClass,
  lane: number,
  from: Point,
  to: Point,
  fromNode: string,
  toNode: string,
  halfFrom: number,
  halfTo: number,
): Lane {
  const along = direction(from, to)
  const side = rightOf(along)
  const offset = road.offset(lane)
  const start = offsetBy(offsetBy(from, along, halfFrom), side, offset)
  const end = offsetBy(offsetBy(to, along, -halfTo), side, offset)
  return new Lane(id, Path.straight(start, end), road, lane, segment.id, fromNode, toNode, along)
}

/**
 * Every way out of a junction, lane by lane. A car keeps its place in the road
 * going straight on, turns right out of the kerb lane into the kerb lane, and
 * turns left out of the lane against the centreline into the same. So a turn is
 * never a diagonal across two lanes of the road it is joining, and nothing
 * changes lane inside a junction.
 *
 * A lane that the rule leaves with nowhere to go, which a bend in a four lane
 * road would, takes the way out nearest its own place instead: every lane that
 * arrives at a junction with a road out of it can leave.
 */
function link(junction: Junction): void {
  for (const entry of junction.entries) {
    const ways = junction.exits.filter((exit) => exit.toNode !== entry.fromNode)
    const chosen = ways.filter((exit) => follows(entry, exit))
    for (const exit of chosen.length > 0 ? chosen : nearest(entry, ways)) {
      junction.links.push(cross(junction, entry, exit))
    }
  }
}

/** True when this exit lane is the one a car in this entry lane drives into. */
function follows(entry: Lane, exit: Lane): boolean {
  switch (turnOf(entry.direction, exit.direction)) {
    case 'straight':
      return exit.lane === Math.min(entry.lane, exit.lanes - 1)
    case 'right':
      return entry.lane === entry.lanes - 1 && exit.lane === exit.lanes - 1
    case 'left':
      return entry.lane === 0 && exit.lane === 0
  }
}

/** One way on for a lane the rule stranded: the lane nearest its own, on each road out. */
function nearest(entry: Lane, ways: readonly Lane[]): Lane[] {
  const bySegment = new Map<string, Lane>()
  for (const exit of ways) {
    const held = bySegment.get(exit.segmentId)
    const closer = !held || Math.abs(exit.lane - entry.lane) < Math.abs(held.lane - entry.lane)
    if (closer) bySegment.set(exit.segmentId, exit)
  }
  return [...bySegment.values()]
}

function cross(junction: Junction, entry: Lane, exit: Lane): Link {
  const from = entry.path.pointAt(entry.length)
  const to = exit.path.pointAt(0)
  const turn = turnOf(entry.direction, exit.direction)
  const path =
    turn === 'straight'
      ? Path.straight(from, to)
      : Path.curve(from, tangentCrossing(from, entry.direction, to, exit.direction), to, CURVE_STEPS)
  const limit = turn === 'straight' ? Math.min(entry.speedLimit, exit.speedLimit) : TURN_SPEED
  return new Link(`${entry.id}>${exit.id}`, path, limit, junction.id, entry, exit, turn)
}

function turnOf(into: Point, out: Point): Turn {
  const side = rightOf(into)
  const dot = side.x * out.x + side.z * out.z
  if (dot > 0.5) return 'right'
  if (dot < -0.5) return 'left'
  return 'straight'
}
