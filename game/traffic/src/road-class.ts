import { METRICS, type RoadSegment } from '@gb/world'
import { SPEED_LIMIT } from './settings.ts'

/**
 * How wide one class of road is and where its lanes sit in it.
 *
 * The width is the class's own, from `@gb/world`'s `METRICS.road`, and the
 * roadway is split evenly between the lanes the segment carries. So a 10 m
 * street is two 5 m lanes centred 2.5 m either side of the centreline, a 14 m
 * avenue is four 3.5 m lanes at 1.75 and 5.25 m, and the 18 m road out is four
 * 4.5 m lanes at 2.25 and 6.75 m. Nothing is measured off the grid.
 */
export class RoadClass {
  readonly kind: RoadSegment['kind']
  /** Kerb to kerb, in metres. */
  readonly roadway: number
  /** Lanes both ways together, always even. */
  readonly lanes: number
  /** Lanes running one way, which is half of them. */
  readonly perWay: number
  readonly laneWidth: number
  readonly speedLimit: number

  constructor(segment: RoadSegment, cellSize: number) {
    const width = METRICS.road[segment.kind]
    this.kind = segment.kind
    this.roadway = width.roadwayCells * cellSize
    this.lanes = evenLanes(segment.lanes, width.lanes)
    this.perWay = this.lanes / 2
    this.laneWidth = this.roadway / this.lanes
    this.speedLimit = SPEED_LIMIT[segment.kind]
  }

  /**
   * Metres to the right of the centreline for one lane, counted from the
   * centreline out: lane 0 is the overtaking side, the last one is the kerb.
   */
  offset(lane: number): number {
    return (lane + 0.5) * this.laneWidth
  }
}

/** A road has the same number of lanes each way, so an odd or missing count falls back to the class's own. */
function evenLanes(carried: number, standard: number): number {
  return Number.isInteger(carried) && carried >= 2 && carried % 2 === 0 ? carried : standard
}
