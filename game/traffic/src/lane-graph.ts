import { cellCentre, type RoadNode, type RoadSegment } from '@gb/world'
import { err, ok, type Result } from '@gb/kit'
import type { TrafficError } from './errors.ts'
import { direction, distance, offsetBy, Path, rightOf, tangentCrossing, type Point } from './geometry.ts'
import { Junction, Lane, Link, type Turn } from './track.ts'
import { SPEED_LIMIT, TURN_SPEED } from './settings.ts'

export interface Roads {
  readonly nodes: readonly RoadNode[]
  readonly segments: readonly RoadSegment[]
}

export interface GraphShape {
  /** Metres per grid cell, from the world. */
  readonly cellSize: number
  /** Width of the roadway in metres. Two lanes share it. */
  readonly roadway: number
  /** How long a car is, so a lane too short to hold one is not offered. */
  readonly carLength: number
}

const CURVE_STEPS = 8

/**
 * The road graph as something you can drive: one lane each way per segment,
 * offset to the right of the centre line, plus the way across every junction.
 *
 * Segments carry no direction and no width, so the rule is fixed here: right
 * hand traffic, one lane per direction, each half of the roadway wide.
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

    const half = shape.roadway / 2
    const offset = shape.roadway / 4
    const lanes: Lane[] = []
    const junctions = new Map<string, Junction>()
    for (const [id, centre] of centres) junctions.set(id, new Junction(id, centre, half))

    for (const segment of roads.segments) {
      const a = centres.get(segment.from)
      const b = centres.get(segment.to)
      if (!a || !b) {
        return err({ code: 'broken-graph', message: `segment ${segment.id} points at a node that is not there` })
      }
      if (distance(a, b) <= shape.roadway) continue // the junctions already overlap: no lane fits
      const limit = SPEED_LIMIT[segment.kind]
      lanes.push(cut(`${segment.id}_f`, segment, a, b, segment.from, segment.to, half, offset, limit))
      lanes.push(cut(`${segment.id}_b`, segment, b, a, segment.to, segment.from, half, offset, limit))
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

/** One direction of a segment, stopped short of the junction at each end. */
function cut(
  id: string,
  segment: RoadSegment,
  from: Point,
  to: Point,
  fromNode: string,
  toNode: string,
  half: number,
  offset: number,
  limit: number,
): Lane {
  const along = direction(from, to)
  const side = rightOf(along)
  const start = offsetBy(offsetBy(from, along, half), side, offset)
  const end = offsetBy(offsetBy(to, along, -half), side, offset)
  return new Lane(id, Path.straight(start, end), limit, segment.id, fromNode, toNode, along)
}

/** Every entry to a junction is joined to every exit but the one it came from. */
function link(junction: Junction): void {
  for (const entry of junction.entries) {
    for (const exit of junction.exits) {
      if (exit.toNode === entry.fromNode) continue // no turning back the way you came
      const from = entry.path.pointAt(entry.length)
      const to = exit.path.pointAt(0)
      const turn = turnOf(entry.direction, exit.direction)
      const path =
        turn === 'straight'
          ? Path.straight(from, to)
          : Path.curve(from, tangentCrossing(from, entry.direction, to, exit.direction), to, CURVE_STEPS)
      const limit = turn === 'straight' ? Math.min(entry.speedLimit, exit.speedLimit) : TURN_SPEED
      junction.links.push(new Link(`${entry.id}>${exit.id}`, path, limit, junction.id, entry, exit, turn))
    }
  }
}

function turnOf(into: Point, out: Point): Turn {
  const side = rightOf(into)
  const dot = side.x * out.x + side.z * out.z
  if (dot > 0.5) return 'right'
  if (dot < -0.5) return 'left'
  return 'straight'
}
