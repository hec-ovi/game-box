import type { Car } from './car.ts'
import type { Path, Point } from './geometry.ts'

export type Turn = 'straight' | 'left' | 'right'

/**
 * A piece of road exactly one car wide that cars drive along in one direction.
 * Every car on it is at a distance in metres from its start, and the list is
 * kept in order with the car furthest along first, which makes "who is in front
 * of me" a lookup rather than a search.
 */
export abstract class Track {
  readonly id: string
  readonly path: Path
  readonly speedLimit: number
  readonly cars: Car[] = []

  constructor(id: string, path: Path, speedLimit: number) {
    this.id = id
    this.path = path
    this.speedLimit = speedLimit
  }

  get length(): number {
    return this.path.length
  }

  /** The car nearest the start of the track, which is the one a joiner follows. */
  get last(): Car | undefined {
    return this.cars[this.cars.length - 1]
  }
}

/** The stretch of one road segment between two junctions, in one direction. */
export class Lane extends Track {
  readonly segmentId: string
  readonly fromNode: string
  readonly toNode: string
  readonly direction: Point

  constructor(
    id: string,
    path: Path,
    speedLimit: number,
    segmentId: string,
    fromNode: string,
    toNode: string,
    direction: Point,
  ) {
    super(id, path, speedLimit)
    this.segmentId = segmentId
    this.fromNode = fromNode
    this.toNode = toNode
    this.direction = direction
  }
}

/** The way through a junction from one lane to the next. Turns are slower. */
export class Link extends Track {
  readonly junctionId: string
  readonly from: Lane
  readonly to: Lane
  readonly turn: Turn

  constructor(id: string, path: Path, speedLimit: number, junctionId: string, from: Lane, to: Lane, turn: Turn) {
    super(id, path, speedLimit)
    this.junctionId = junctionId
    this.from = from
    this.to = to
    this.turn = turn
  }
}

/** Where roads meet: the square of roadway they share and every way across it. */
export class Junction {
  readonly id: string
  readonly centre: Point
  readonly half: number
  readonly entries: Lane[] = []
  readonly exits: Lane[] = []
  readonly links: Link[] = []

  constructor(id: string, centre: Point, half: number) {
    this.id = id
    this.centre = centre
    this.half = half
  }

  /** True when a point is inside the shared square, which is what "in the junction" means. */
  contains(p: Point): boolean {
    return Math.abs(p.x - this.centre.x) <= this.half && Math.abs(p.z - this.centre.z) <= this.half
  }
}
