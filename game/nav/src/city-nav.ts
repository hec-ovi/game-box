import { cellCentre, type CellKind, type World } from '@gb/world'
import { MinHeap } from './heap.ts'

export interface Cell {
  readonly x: number
  readonly y: number
}

export interface Point {
  readonly x: number
  readonly z: number
}

/**
 * What it costs to walk over each kind of ground. Sidewalks are cheapest, so
 * pedestrians use them and only cross the road when they have to.
 */
export const WALK_COST: Record<CellKind, number> = {
  sidewalk: 1,
  park: 1.2,
  empty: 1.6,
  street: 3,
  building: Number.POSITIVE_INFINITY,
  mountain: Number.POSITIVE_INFINITY,
  water: Number.POSITIVE_INFINITY,
}

const DIAGONAL = Math.SQRT2
const STEPS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, DIAGONAL],
  [1, -1, DIAGONAL],
  [-1, 1, DIAGONAL],
  [-1, -1, DIAGONAL],
]

/**
 * Walking routes across a city, straight off the grid it was generated on.
 * No navmesh to bake: the grid already says what is ground and what is wall,
 * which is the point of generating the city as a matrix in the first place.
 */
export class CityNav {
  readonly width: number
  readonly height: number
  #cost: Float32Array
  #cellSize: number
  /** Reused between searches so a busy street of NPCs does not allocate per path. */
  #gScore: Float64Array
  #cameFrom: Int32Array
  #stamp: Int32Array
  #run = 0

  private constructor(width: number, height: number, cost: Float32Array, cellSize: number) {
    this.width = width
    this.height = height
    this.#cost = cost
    this.#cellSize = cellSize
    this.#gScore = new Float64Array(width * height)
    this.#cameFrom = new Int32Array(width * height)
    this.#stamp = new Int32Array(width * height)
  }

  static from(world: World, costs: Partial<Record<CellKind, number>> = {}): CityNav {
    const table = { ...WALK_COST, ...costs }
    const { width, height } = world.grid
    const cost = new Float32Array(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const kind = world.grid.at(x, y)
        cost[y * width + x] = kind ? table[kind] : Number.POSITIVE_INFINITY
      }
    }
    return new CityNav(width, height, cost, world.cellSize)
  }

  walkable(cell: Cell): boolean {
    if (cell.x < 0 || cell.y < 0 || cell.x >= this.width || cell.y >= this.height) return false
    return Number.isFinite(this.#cost[cell.y * this.width + cell.x]!)
  }

  /** The cheapest walk from one cell to another, or undefined when there is none. */
  path(from: Cell, to: Cell): Cell[] | undefined {
    if (!this.walkable(from) || !this.walkable(to)) return undefined
    const start = from.y * this.width + from.x
    const goal = to.y * this.width + to.x
    if (start === goal) return [from]

    const run = ++this.#run
    const open = new MinHeap(this.width * this.height)
    this.#gScore[start] = 0
    this.#cameFrom[start] = -1
    this.#stamp[start] = run
    open.push(start, this.#heuristic(from, to))

    while (open.size) {
      const current = open.pop()!
      if (current === goal) return this.#rebuild(goal)

      const cx = current % this.width
      const cy = (current - cx) / this.width
      const currentScore = this.#gScore[current]!

      for (const [dx, dy, stride] of STEPS) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue
        const neighbour = ny * this.width + nx
        const stepCost = this.#cost[neighbour]!
        if (!Number.isFinite(stepCost)) continue
        // no squeezing between two corners
        if (dx !== 0 && dy !== 0) {
          if (!Number.isFinite(this.#cost[cy * this.width + nx]!)) continue
          if (!Number.isFinite(this.#cost[ny * this.width + cx]!)) continue
        }

        const tentative = currentScore + stepCost * stride
        if (this.#stamp[neighbour] === run && tentative >= this.#gScore[neighbour]!) continue
        this.#stamp[neighbour] = run
        this.#gScore[neighbour] = tentative
        this.#cameFrom[neighbour] = current
        open.push(neighbour, tentative + this.#heuristic({ x: nx, y: ny }, to))
      }
    }
    return undefined
  }

  reachable(from: Cell, to: Cell): boolean {
    return this.path(from, to) !== undefined
  }

  /** Walk to a building's doorstep. */
  pathToDoor(world: World, from: Cell, plotId: string): Cell[] | undefined {
    const plot = world.plot(plotId)
    if (!plot) return undefined
    return this.path(from, plot.entrance.cell)
  }

  /**
   * The same route with the straight stretches collapsed, in metres: what an
   * NPC actually walks, instead of one waypoint per cell.
   */
  waypoints(path: readonly Cell[]): Point[] {
    if (path.length === 0) return []
    const corners: Cell[] = [path[0]!]
    for (let i = 1; i < path.length - 1; i++) {
      const previous = path[i - 1]!
      const cell = path[i]!
      const next = path[i + 1]!
      const turned = cell.x - previous.x !== next.x - cell.x || cell.y - previous.y !== next.y - cell.y
      if (turned) corners.push(cell)
    }
    if (path.length > 1) corners.push(path[path.length - 1]!)
    return corners.map((cell) => cellCentre(cell.x, cell.y, this.#cellSize))
  }

  #heuristic(from: Cell, to: Cell): number {
    const dx = Math.abs(from.x - to.x)
    const dy = Math.abs(from.y - to.y)
    // octile distance, scaled by the cheapest ground so it never overestimates
    return (Math.max(dx, dy) + (DIAGONAL - 1) * Math.min(dx, dy)) * WALK_COST.sidewalk
  }

  #rebuild(goal: number): Cell[] {
    const cells: Cell[] = []
    let current = goal
    while (current !== -1) {
      const x = current % this.width
      cells.push({ x, y: (current - x) / this.width })
      current = this.#cameFrom[current]!
    }
    return cells.reverse()
  }
}
