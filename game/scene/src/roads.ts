import type { CellKind, Grid, RoadNode, RoadSegment, World } from '@gb/world'

/** Which way a road runs: along world x, or along world z. */
export type RoadAxis = 'x' | 'z'

/** One end of a link, where its roadway opens into a junction. */
export interface RoadArm {
  /** Metres along the axis: where the roadway between the junctions starts. */
  readonly mouth: number
  /** Which way the roadway runs from here, +1 or -1 along the axis. */
  readonly into: 1 | -1
  /** A pavement run crosses the roadway here or comes up to its side, so people cross here. */
  readonly pavement: boolean
}

/** A stretch of roadway between two junctions, measured off the grid it is painted on. */
export interface RoadLink {
  readonly id: string
  readonly axis: RoadAxis
  /** Metres across the axis: the middle of the roadway. */
  readonly centre: number
  /** Metres: half the width of the roadway. */
  readonly half: number
  /** The low end of the axis first. */
  readonly ends: readonly [RoadArm, RoadArm]
}

interface Cell {
  readonly x: number
  readonly y: number
}

/** How far past a junction a pavement run may sit before the arm is given up on. */
const ARM_REACH = 4

/**
 * The city's roads as the street painter needs them: the world's road graph
 * says which junctions are joined, and the grid under it says how wide the
 * roadway actually is and where its mouth opens. Neither on its own is enough:
 * the graph carries no width, and the grid alone cannot tell a junction from a
 * crossroads of paint.
 */
export class RoadNetwork {
  #grid: Grid
  #cell: number
  #links: RoadLink[]

  constructor(world: World) {
    this.#grid = world.grid
    this.#cell = world.cellSize
    const roads = world.toJSON().roads
    const at = new Map<string, Cell>((roads?.nodes ?? []).map((node: RoadNode) => [node.id, node.cell]))
    this.#links = []
    for (const segment of roads?.segments ?? []) {
      const link = this.#link(segment, at.get(segment.from), at.get(segment.to))
      if (link) this.#links.push(link)
    }
  }

  links(): readonly RoadLink[] {
    return this.#links
  }

  /** One segment of the graph, if it runs along an axis and lands on roadway. */
  #link(segment: RoadSegment, from: Cell | undefined, to: Cell | undefined): RoadLink | undefined {
    if (!from || !to) return undefined
    const axis = axisOf(from, to)
    if (!axis) return undefined

    const [near, far] = along(from, axis) < along(to, axis) ? [from, to] : [to, from]
    const width = this.#width(near, far, axis)
    if (!width) return undefined

    const ends = [this.#arm(near, axis, 1, width.cells), this.#arm(far, axis, -1, width.cells)]
    if (!ends[0] || !ends[1]) return undefined
    if (ends[1].mouth - ends[0].mouth <= 0) return undefined

    return { id: segment.id, axis, centre: width.centre, half: width.half, ends: [ends[0], ends[1]] }
  }

  /** The roadway across the middle of the link, where no junction widens it. */
  #width(near: Cell, far: Cell, axis: RoadAxis): { centre: number; half: number; cells: number } | undefined {
    const middle = { x: Math.round((near.x + far.x) / 2), y: Math.round((near.y + far.y) / 2) }
    for (let step = 0; step <= ARM_REACH; step++) {
      for (const way of step === 0 ? [1] : [1, -1]) {
        const cell = shift(middle, axis, step * way)
        const run = this.#run(cell, axis)
        if (run) {
          const cells = run.to - run.from + 1
          return { centre: ((run.from + run.to + 1) / 2) * this.#cell, half: (cells / 2) * this.#cell, cells }
        }
      }
    }
    return undefined
  }

  /** The run of street cells across the road through this cell, in cell indices. */
  #run(cell: Cell, axis: RoadAxis): { from: number; to: number } | undefined {
    if (this.#kind(cell) !== 'street') return undefined
    const reach = (way: 1 | -1) => {
      let last = 0
      while (this.#kind(across(cell, axis, last + way)) === 'street') last += way
      return last
    }
    const start = across(cell, axis, reach(-1))
    const end = across(cell, axis, reach(1))
    return { from: acrossOf(start, axis), to: acrossOf(end, axis) }
  }

  /** Where the roadway starts on one side of a junction, and whether people cross there. */
  #arm(node: Cell, axis: RoadAxis, into: 1 | -1, widthCells: number): RoadArm | undefined {
    let steps = Math.floor(widthCells / 2) + 1
    let pavement = false
    let cell = shift(node, axis, steps * into)
    const limit = steps + ARM_REACH

    while (this.#kind(cell) !== 'street' && steps <= limit) {
      if (this.#kind(cell) === undefined) return undefined
      if (this.#kind(cell) === 'sidewalk') pavement = true
      steps++
      cell = shift(node, axis, steps * into)
    }
    if (this.#kind(cell) !== 'street') return undefined

    const index = along(cell, axis)
    return { mouth: (into > 0 ? index : index + 1) * this.#cell, into, pavement: pavement || this.#flanked(cell, axis) }
  }

  /** True when the pavement comes up to the side of the roadway here. */
  #flanked(cell: Cell, axis: RoadAxis): boolean {
    const run = this.#run(cell, axis)
    if (!run) return false
    const beside = (index: number) => this.#kind(across(cell, axis, index - acrossOf(cell, axis)))
    return beside(run.from - 1) === 'sidewalk' || beside(run.to + 1) === 'sidewalk'
  }

  #kind(cell: Cell): CellKind | undefined {
    return this.#grid.at(cell.x, cell.y)
  }
}

/** The axis a pair of cells lies on, or nothing when they lie on neither. */
function axisOf(from: Cell, to: Cell): RoadAxis | undefined {
  if (from.y === to.y && from.x !== to.x) return 'x'
  if (from.x === to.x && from.y !== to.y) return 'z'
  return undefined
}

/** How far along the axis a cell sits, in cells. */
function along(cell: Cell, axis: RoadAxis): number {
  return axis === 'x' ? cell.x : cell.y
}

/** How far across the axis a cell sits, in cells. */
function acrossOf(cell: Cell, axis: RoadAxis): number {
  return axis === 'x' ? cell.y : cell.x
}

/** The cell this many steps further along the axis. */
function shift(cell: Cell, axis: RoadAxis, steps: number): Cell {
  return axis === 'x' ? { x: cell.x + steps, y: cell.y } : { x: cell.x, y: cell.y + steps }
}

/** The cell this many steps across the axis. */
function across(cell: Cell, axis: RoadAxis, steps: number): Cell {
  return axis === 'x' ? { x: cell.x, y: cell.y + steps } : { x: cell.x + steps, y: cell.y }
}
