import { WIDEST_ROADWAY_CELLS, type CellKind, type World } from '@gb/world'
import type { Cell } from './ports.ts'
import { Sides } from './sides.ts'

/** The one cell kind cars drive on, from `@gb/world`'s `CELL`. */
const ROADWAY: CellKind = 'street'

/** The four ways a crossing can run, in the order the kerb index counts them. */
const WAYS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
] as const

/** Where a pedestrian steps into the road, and where they come out of it. */
export interface Crossing {
  /** The kerb they step off. */
  readonly near: Cell
  /** The kerb on the far side. */
  readonly far: Cell
  /** The way it runs: one compass step, so the roadway cells are `near` plus one to `cells` of these. */
  readonly dx: number
  readonly dy: number
  /** Roadway cells between the two kerbs. */
  readonly cells: number
  /** The pavement each end lands on, from `Sides`. */
  readonly nearSide: number
  readonly farSide: number
}

/**
 * Every place in a city where crossing the road is a crossing rather than
 * stepping off a kerb into the traffic: the roadway gap in a pavement run,
 * which is what a junction leaves behind once the roadway is painted through
 * it in both directions and the pavement keeps a corner in each quarter.
 *
 * A gap counts where the pavement run you are on ends against a road, which is
 * the corner a junction leaves, and the walk carries on at a corner on the far
 * kerb. Stepping off the long side of a band, with the road running on beside
 * you, is not a crossing: it is the middle of the block, and this is what tells
 * the two apart. Pavement behind you does not make a crossing either, because a
 * pavement is two cells deep and there is pavement behind you all along it.
 */
export class Crossings {
  readonly sides: Sides
  #byKerb = new Map<number, Crossing>()
  #bySide = new Map<number, Crossing[]>()
  #width: number
  #cellSize: number
  #count = 0

  private constructor(world: World, sides: Sides) {
    this.sides = sides
    this.#width = world.grid.width
    this.#cellSize = world.cellSize
  }

  /** How many crossings the city has. */
  get count(): number {
    return this.#count
  }

  /** Every crossing, each one twice: once from either kerb. */
  *all(): Generator<Crossing> {
    for (const held of this.#bySide.values()) yield* held
  }

  /** One pass over the grid when the city is loaded. */
  static from(world: World, kinds: readonly CellKind[]): Crossings {
    const found = new Crossings(world, Sides.from(world, kinds))
    const walk = new Set<CellKind>(kinds)
    const { width, height } = world.grid
    const isWalk = (x: number, y: number): boolean => {
      const kind = world.grid.at(x, y)
      return kind !== undefined && walk.has(kind)
    }
    const isRoad = (x: number, y: number): boolean => world.grid.at(x, y) === ROADWAY
    // a kerb worth crossing from: your run ends here against a road, which is
    // the corner a junction leaves. Anywhere else along the band the pavement
    // simply runs on beside the road, and stepping off it is the middle of the
    // block, whether or not there is more pavement behind you
    const kerb = (x: number, y: number, dx: number, dy: number): boolean =>
      isRoad(x - dy, y - dx) || isRoad(x + dy, y + dx)
    // the widest road there is, plus the far kerb: an avenue and the road out
    // are wider than a street, and a cap read off one class misses them all
    const widest = WIDEST_ROADWAY_CELLS + 1

    for (const { dx, dy } of [WAYS[0], WAYS[2]]) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!isWalk(x, y) || !isRoad(x + dx, y + dy) || !kerb(x, y, dx, dy)) continue
          let span = 1
          while (span <= widest && isRoad(x + dx * span, y + dy * span)) span++
          if (span > widest) continue
          const fx = x + dx * span
          const fy = y + dy * span
          if (!isWalk(fx, fy) || !kerb(fx, fy, -dx, -dy)) continue
          found.#keep({ x, y }, { x: fx, y: fy }, dx, dy, span - 1)
          found.#count++
        }
      }
    }
    return found
  }

  /** True when stepping straight from one kerb to the other is a crossing. */
  spans(near: Cell, far: Cell): boolean {
    const crossing = this.#atKerb(near, Math.sign(far.x - near.x), Math.sign(far.y - near.y))
    return crossing !== undefined && crossing.far.x === far.x && crossing.far.y === far.y
  }

  /**
   * The shortest way of crossing from one kerb to another by way of crossings,
   * as the one or two of them it takes, or none when that is further than
   * `spare` metres out of the way. Two is enough for the town plans this box
   * has seen: a corner where the ring pavement does not run straight opposite
   * takes one crossing round the junction and a second over the other road.
   *
   * Distance is straight-line, which is what the walk along a pavement is
   * within a few metres, and it is measured from where the walker is standing,
   * so a crossing behind them costs what walking back to it costs.
   */
  chain(from: Cell, to: Cell, fromSide: number, toSide: number, spare: number): Crossing[] | undefined {
    const budget = this.#metres(from, to) + spare
    const first = this.#bySide.get(fromSide)
    if (!first) return undefined
    let best: Crossing[] | undefined
    let shortest = budget
    for (const one of first) {
      if (one.farSide !== toSide) continue
      const walk = this.#metres(from, one.near) + this.#metres(one.near, one.far) + this.#metres(one.far, to)
      if (walk >= shortest) continue
      shortest = walk
      best = [one]
    }
    if (best) return best
    for (const one of first) {
      const started = this.#metres(from, one.near) + this.#metres(one.near, one.far)
      if (started >= shortest) continue
      for (const two of this.#bySide.get(one.farSide) ?? []) {
        if (two.farSide !== toSide) continue
        const walk =
          started + this.#metres(one.far, two.near) + this.#metres(two.near, two.far) + this.#metres(two.far, to)
        if (walk >= shortest) continue
        shortest = walk
        best = [one, two]
      }
    }
    return best
  }

  /** The roadway cells of a crossing, in the order they are walked. */
  static road(crossing: Crossing): Cell[] {
    const cells: Cell[] = []
    for (let step = 1; step <= crossing.cells; step++) {
      cells.push({ x: crossing.near.x + crossing.dx * step, y: crossing.near.y + crossing.dy * step })
    }
    return cells
  }

  /** Both ways round: a crossing is the same thing whichever kerb you are standing on. */
  #keep(near: Cell, far: Cell, dx: number, dy: number, cells: number): void {
    const nearSide = this.sides.of(near)
    const farSide = this.sides.of(far)
    this.#add({ near, far, dx, dy, cells, nearSide, farSide })
    this.#add({ near: far, far: near, dx: -dx, dy: -dy, cells, nearSide: farSide, farSide: nearSide })
  }

  #add(crossing: Crossing): void {
    this.#byKerb.set(this.#kerbKey(crossing.near, crossing.dx, crossing.dy), crossing)
    const held = this.#bySide.get(crossing.nearSide)
    if (held) held.push(crossing)
    else this.#bySide.set(crossing.nearSide, [crossing])
  }

  #metres(from: Cell, to: Cell): number {
    return Math.hypot(to.x - from.x, to.y - from.y) * this.#cellSize
  }

  #atKerb(cell: Cell, dx: number, dy: number): Crossing | undefined {
    return this.#byKerb.get(this.#kerbKey(cell, dx, dy))
  }

  #kerbKey(cell: Cell, dx: number, dy: number): number {
    const way = WAYS.findIndex((step) => step.dx === dx && step.dy === dy)
    return way === -1 ? -1 : (cell.y * this.#width + cell.x) * 4 + way
  }
}
