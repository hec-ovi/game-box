import type { RoadArm, RoadLink } from './roads.ts'

/** What a painted rectangle on the road is for. */
export type MarkingKind = 'centre-line' | 'edge-line' | 'crossing' | 'stop-bar'

/** North American convention: yellow between the two directions, white for everything else. */
export type MarkingPaint = 'white' | 'yellow'

/** One rectangle of paint on the roadway, in metres. */
export interface Marking {
  readonly kind: MarkingKind
  readonly paint: MarkingPaint
  /** The middle of the rectangle. */
  readonly x: number
  readonly y: number
  readonly z: number
  /** Across the road. */
  readonly width: number
  /** Along the road. */
  readonly length: number
  /** Three.js yaw: at 0 the length runs along z, at a quarter turn along x. */
  readonly rot: number
}

/** What road paint looks like when a dressing has not said otherwise. */
export const PAINT_COLOUR: Record<MarkingPaint, number> = { white: 0xd9d8d2, yellow: 0xd8b23c }

/** Real street sizes, in metres. */
export const MARKING = {
  /** How wide a painted line is. */
  lineWidth: 0.12,
  /** Between the two yellow lines down the middle. */
  centreGap: 0.12,
  /** From the kerb to the outside of the edge line. */
  edgeInset: 0.15,
  /** One bar of a crossing, and the gap to the next. */
  stripeWidth: 0.4,
  stripeGap: 0.4,
  /** How far a crossing reaches along the road. */
  crossingDepth: 2.4,
  /** The bar a car stops at, and how far back from the crossing it sits. */
  stopBarWidth: 0.4,
  stopBarSetback: 1,
  /** Shorter than this and a stretch of road is all junction: no lines. */
  minLine: 1,
  /**
   * How far the paint stands above the road. It clears the wet film the street
   * wears (`SURFACE.lift`), so the grime and the water go under the lines
   * rather than over them and a dark road still reads as a marked road.
   */
  lift: 0.03,
} as const

/**
 * Every marking the city's streets carry, decided by the roads alone: no
 * randomness, so the same city paints the same street every time.
 */
export function planMarkings(links: readonly RoadLink[]): Marking[] {
  const markings: Marking[] = []
  for (const link of links) new LinkPaint(link, markings).paint()
  return markings
}

/** The paint one stretch of road between two junctions carries. */
class LinkPaint {
  #link: RoadLink
  #out: Marking[]

  constructor(link: RoadLink, out: Marking[]) {
    this.#link = link
    this.#out = out
  }

  paint(): void {
    this.#lines()
    for (const arm of this.#link.ends) {
      if (arm.pavement) this.#crossing(arm)
      this.#stopBar(arm)
    }
  }

  /** Two yellow down the middle, one white inside each kerb, between the crossings. */
  #lines(): void {
    const [near, far] = this.#link.ends
    const from = near.mouth + near.into * this.#clear(near)
    const to = far.mouth + far.into * this.#clear(far)
    const length = to - from
    if (length < MARKING.minLine) return

    const at = (from + to) / 2
    const middle = (MARKING.lineWidth + MARKING.centreGap) / 2
    this.#add('centre-line', 'yellow', at, -middle, MARKING.lineWidth, length)
    this.#add('centre-line', 'yellow', at, middle, MARKING.lineWidth, length)

    const edge = this.#link.half - MARKING.edgeInset - MARKING.lineWidth / 2
    if (edge <= middle) return
    this.#add('edge-line', 'white', at, -edge, MARKING.lineWidth, length)
    this.#add('edge-line', 'white', at, edge, MARKING.lineWidth, length)
  }

  /** Bars across the roadway, laid along the way the cars go, out to the gutter on each side. */
  #crossing(arm: RoadArm): void {
    const pitch = MARKING.stripeWidth + MARKING.stripeGap
    const usable = this.#link.half * 2 - MARKING.edgeInset * 2
    const count = Math.floor((usable + MARKING.stripeGap) / pitch)
    if (count < 2) return

    const span = count * pitch - MARKING.stripeGap
    const at = arm.mouth + (arm.into * MARKING.crossingDepth) / 2
    for (let i = 0; i < count; i++) {
      const across = -span / 2 + MARKING.stripeWidth / 2 + i * pitch
      this.#add('crossing', 'white', at, across, MARKING.stripeWidth, MARKING.crossingDepth)
    }
  }

  /** The bar the approaching side stops at: right hand traffic, so the far half is somebody else's. */
  #stopBar(arm: RoadArm): void {
    const inner = MARKING.lineWidth + MARKING.centreGap / 2
    const outer = this.#link.half - MARKING.edgeInset - MARKING.lineWidth
    if (outer - inner < MARKING.stripeWidth) return

    const at = arm.mouth + arm.into * (this.#clear(arm) + MARKING.stopBarSetback + MARKING.stopBarWidth / 2)
    const side = this.#link.axis === 'z' ? arm.into : -arm.into
    this.#add('stop-bar', 'white', at, (side * (inner + outer)) / 2, outer - inner, MARKING.stopBarWidth)
  }

  /** How much of the roadway the crossing at this end already takes. */
  #clear(arm: RoadArm): number {
    return arm.pavement ? MARKING.crossingDepth : 0
  }

  /** Along the road and across it, turned into where the rectangle lands in the city. */
  #add(kind: MarkingKind, paint: MarkingPaint, at: number, across: number, width: number, length: number): void {
    const { axis, centre } = this.#link
    this.#out.push({
      kind,
      paint,
      x: axis === 'z' ? centre + across : at,
      y: MARKING.lift,
      z: axis === 'z' ? at : centre + across,
      width,
      length,
      rot: axis === 'z' ? 0 : Math.PI / 2,
    })
  }
}
