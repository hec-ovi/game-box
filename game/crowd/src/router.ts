import { Crossings } from './crossings.ts'
import type { Ground } from './ground.ts'
import type { Cell, CrowdNav, Point } from './ports.ts'

export interface RouterDeps {
  readonly nav: CrowdNav
  readonly ground: Ground
  readonly crossings: Crossings
  /** How far out of their way a walker will go to reach a crossing, in metres. */
  readonly detour: number
}

/** How many roadways one trip is rerouted over. Past this the route is walked as it came. */
const MENDS = 3

/**
 * Where a pedestrian goes and how they get there. The route is the city's,
 * from `@gb/nav`: this is a pass over it that moves the places it steps into
 * the road onto crossings, the way somebody walks to the corner rather than
 * out between two parked cars.
 *
 * A crossing that is too far out of the way is not taken: past
 * `crossingDetour` metres the walker crosses where the route does, which is
 * still a look before stepping off the kerb, never a walk into the traffic.
 */
export class Router {
  #nav: CrowdNav
  #ground: Ground
  #crossings: Crossings
  #detour: number

  constructor(deps: RouterDeps) {
    this.#nav = deps.nav
    this.#ground = deps.ground
    this.#crossings = deps.crossings
    this.#detour = deps.detour
  }

  /** The corners of a walk from one cell to another, or nothing when there is no way there. */
  route(from: Cell, to: Cell): Point[] | undefined {
    const path = this.#nav.path(from, to)
    if (!path || path.length === 0) return undefined
    return this.#nav.waypoints(this.#mend(path))
  }

  /**
   * The same route with every stretch of roadway it steps into replaced by the
   * walk to a crossing and back. A stretch that is already a crossing is left
   * alone, and so is one with no crossing between the two pavements.
   */
  #mend(path: readonly Cell[]): readonly Cell[] {
    if (this.#crossings.count === 0) return path
    // nothing is copied until the first mend, so a route that needs none is handed back as it came
    let mended: Cell[] | undefined
    let mends = 0
    let i = 1
    while (i < path.length) {
      const cell = path[i]!
      if (!this.#ground.roadway(cell)) {
        mended?.push(cell)
        i++
        continue
      }
      let out = i
      while (out < path.length && this.#ground.roadway(path[out]!)) out++
      const near = path[i - 1]!
      const far = path[out]
      const around =
        far !== undefined && mends < MENDS && !this.#crossings.spans(near, far)
          ? this.#viaCrossing(near, far)
          : undefined
      if (around) {
        mended ??= path.slice(0, i)
        for (const step of around) mended.push(step)
        mends++
      } else {
        const last = Math.min(out, path.length - 1)
        for (let step = i; step <= last; step++) mended?.push(path[step]!)
      }
      i = out + 1
    }
    return mended ?? path
  }

  /**
   * The walk from one kerb to the other by way of crossings: along the
   * pavement to the first one, over the road, on to the next if the corner
   * takes two, and out where the route was going. Any leg that would step into
   * the road itself is refused, so mending a crossing never invents another.
   */
  #viaCrossing(near: Cell, far: Cell): Cell[] | undefined {
    const nearSide = this.#crossings.sides.of(near)
    const farSide = this.#crossings.sides.of(far)
    if (nearSide < 0 || farSide < 0 || nearSide === farSide) return undefined
    const chain = this.#crossings.chain(near, far, nearSide, farSide, this.#detour)
    if (!chain) return undefined
    const walk: Cell[] = []
    let at = near
    for (const crossing of chain) {
      const leg = this.#leg(at, crossing.near)
      if (!leg) return undefined
      for (const cell of leg.slice(1)) walk.push(cell)
      for (const cell of Crossings.road(crossing)) walk.push(cell)
      walk.push(crossing.far)
      at = crossing.far
    }
    const onward = this.#leg(at, far)
    if (!onward) return undefined
    for (const cell of onward.slice(1)) walk.push(cell)
    return walk
  }

  /** A stretch of pavement between two cells: the route home to the crossing, or nothing usable. */
  #leg(from: Cell, to: Cell): Cell[] | undefined {
    const path = this.#nav.path(from, to)
    if (!path || path.length === 0) return undefined
    const end = path[path.length - 1]!
    if (end.x !== to.x || end.y !== to.y) return undefined
    for (const cell of path) if (this.#ground.roadway(cell)) return undefined
    return path
  }
}
