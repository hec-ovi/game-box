import { METRICS, type RoadKind } from '@gb/world'
import { avenueCount } from './avenues.ts'

/** Cells of mountain around the whole map. */
export const MOUNTAIN_CELLS = 4

/** The classes of road a town is laid out in. The road out of the valley is not a band. */
export type BandKind = Exclude<RoadKind, 'exit'>

export interface Cell {
  readonly x: number
  readonly y: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

/**
 * One class of road as grid arithmetic: how wide its band is, where its
 * centreline runs inside it, and how far its kerbs stand from that centreline.
 * The widths themselves are `@gb/world`'s, so the width a car drives and the
 * width the city is laid with are one number per class.
 */
export class RoadBand {
  readonly kind: RoadKind
  /** Cells of roadway, kerb to kerb. */
  readonly roadway: number
  /** Cells of pavement on each side of it. */
  readonly pavement: number
  /** Lanes of traffic, both directions. */
  readonly lanes: number

  constructor(kind: RoadKind) {
    const width = METRICS.road[kind]
    this.kind = kind
    this.roadway = width.roadwayCells
    this.pavement = width.pavementCells
    this.lanes = width.lanes
  }

  /** Pavement, roadway, pavement: the whole band. */
  get width(): number {
    return this.pavement * 2 + this.roadway
  }

  /** Cells from the near edge of the band to the cell its roadway is centred on. */
  get centreline(): number {
    return this.pavement + this.halfRoadway
  }

  /** Cells from that centreline to the last cell of roadway on either side. */
  get halfRoadway(): number {
    return (this.roadway - 1) / 2
  }
}

export const BANDS: Record<RoadKind, RoadBand> = {
  street: new RoadBand('street'),
  avenue: new RoadBand('avenue'),
  exit: new RoadBand('exit'),
}

/** One street band in a plan: where it starts, what it is, and the geometry that follows from those two. */
export interface StreetLine {
  readonly start: number
  readonly kind: BandKind
  /** Cells across the whole band, pavement to pavement. */
  readonly width: number
  /** The cell coordinate of its centreline: where the road graph's nodes sit. */
  readonly centre: number
}

/** The one place a band's geometry is worked out from where it starts and what it is. */
export function lineAt(start: number, kind: BandKind): StreetLine {
  const band = BANDS[kind]
  return { start, kind, width: band.width, centre: start + band.centreline }
}

/**
 * Cells from one edge of the map to the other along one axis, mountains
 * included: a street band before every block, one more after the last, and the
 * mountain ring around the lot. Avenues are wider than streets, so this is the
 * widest a town of this many blocks can be laid: leaving an inner street out
 * only ever makes it narrower.
 */
export function spanOf(blocks: number, blockCells: number): number {
  const avenues = avenueCount(blocks + 1)
  const bands = BANDS.street.width * (blocks + 1 - avenues) + BANDS.avenue.width * avenues
  return MOUNTAIN_CELLS * 2 + bands + blockCells * blocks
}
