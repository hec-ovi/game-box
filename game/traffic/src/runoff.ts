import { offsetBy, Path } from './geometry.ts'
import type { LaneGraph } from './lane-graph.ts'
import { Lane, Track } from './track.ts'

/**
 * The last stretch of the road out of town: straight on from the final junction,
 * off the edge of the map, for as far as the ground is still graded for a road.
 * A car that gets here has left the city; it is taken off the board out there,
 * not in the middle of the street.
 */
export class Runoff extends Track {
  readonly from: Lane

  constructor(lane: Lane, length: number) {
    const end = lane.path.pointAt(lane.length)
    const on = lane.path.directionAt(lane.length)
    super(`${lane.id}>out`, Path.straight(end, offsetBy(end, on, length)), lane.speedLimit)
    this.from = lane
  }
}

/**
 * Which lanes carry on past the map and which simply stop. Only the road out of
 * town does: an `exit` lane with no junction to turn into is the way off the
 * map, and `@gb/land` grades the ground under it. Any other lane that runs out
 * of graph is a dead end in the middle of the city, and driving a car off the
 * end of one would put it through a building.
 */
export class Runoffs {
  readonly #byLane = new Map<string, Runoff>()

  constructor(graph: LaneGraph, length: number) {
    for (const lane of graph.lanes) {
      if (lane.kind !== 'exit' || graph.linksFrom(lane).length > 0) continue
      this.#byLane.set(lane.id, new Runoff(lane, length))
    }
  }

  /** Where a car drives when it reaches the end of this lane, if anywhere. */
  after(lane: Lane): Runoff | undefined {
    return this.#byLane.get(lane.id)
  }

  /** Every way off the map, for anything that needs to know where the roads are. */
  get all(): Iterable<Runoff> {
    return this.#byLane.values()
  }

  /** How many ways out of the map there are. */
  get count(): number {
    return this.#byLane.size
  }
}
