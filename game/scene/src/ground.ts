import { cellCentre, METRICS, type CellKind, type Grid, type Rect, type World } from '@gb/world'
import * as THREE from 'three'
import type { Dressing } from './dressing.ts'
import { QuadMesh, type Corner } from './quads.ts'

/** The surfaces the city floor is made of. The verge is `@gb/land`'s, and gets no mesh here. */
export const GROUND_KINDS: readonly CellKind[] = ['street', 'sidewalk', 'park', 'building', 'empty', 'water']

/** The surfaces rain lands on and rubbish gathers on: the street and the pavement beside it. */
export const PAVED_KINDS: readonly CellKind[] = ['street', 'sidewalk']

/** Pavement and parks stand a kerb above the roadway; roads, land and water are at zero. */
const RAISED = new Set<CellKind>(['sidewalk', 'park'])

/** How deep the ground is buried where the world ends. */
const GROUND_BASE = -2

/** How tall the stand-in ring is, for a city standing on its own with no landscape around it. */
const STANDIN_HEIGHT = 26

interface Side {
  readonly x: number
  readonly z: number
}

const SIDES: readonly Side[] = [
  { x: 0, z: -1 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 1, z: 0 },
]

/** Top of the ground in a cell, in metres. Past the edge of the grid the ground has already ended. */
export function groundTop(kind: CellKind | undefined): number {
  if (kind === undefined) return GROUND_BASE
  return RAISED.has(kind) ? METRICS.street.curbHeight : 0
}

/**
 * How far the ground falls from a cell of this height to the cell beside it,
 * or nothing when it does not fall. A `mountain` cell is the valley wall:
 * `@gb/land` starts its rise at the top of whatever surface it meets, so
 * there is never a drop to close and never a kerb against it.
 */
function dropTo(top: number, beside: CellKind | undefined): number | undefined {
  if (beside === 'mountain') return undefined
  const low = groundTop(beside)
  return low < top ? low : undefined
}

/**
 * One mesh for a whole surface: the top merged into as few quads as the grid
 * allows, plus a kerb face wherever it stands above what is beside it. A city
 * of thousands of cells stays a handful of draws and has no seam you can see
 * under.
 */
export function groundMesh(world: World, kind: CellKind, dressing: Dressing): THREE.Mesh | undefined {
  const geometry = surfaceGeometry(world, kind)
  if (!geometry) return undefined

  const mesh = new THREE.Mesh(geometry, dressing.ground(kind))
  mesh.name = `ground:${kind}`
  mesh.receiveShadow = true
  return mesh
}

/** The tops and kerbs of one kind of cell, or nothing when the city has none of them. */
export function surfaceGeometry(world: World, kind: CellKind): THREE.BufferGeometry | undefined {
  return new Surface(world, kind).geometry()
}

/**
 * The stand-in ring that closes the view, as one instanced block per verge
 * cell. `@gb/land` draws the real hills a kilometre out and covers the verge
 * itself, so a game with a landscape hides this one.
 */
export function mountainMesh(world: World, dressing: Dressing): THREE.InstancedMesh | undefined {
  const cells: Array<{ x: number; y: number }> = []
  for (let y = 0; y < world.grid.height; y++) {
    for (let x = 0; x < world.grid.width; x++) {
      if (world.grid.at(x, y) === 'mountain') cells.push({ x, y })
    }
  }
  if (!cells.length) return undefined

  const size = world.cellSize
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(size, STANDIN_HEIGHT, size),
    dressing.ground('mountain'),
    cells.length,
  )
  mesh.name = 'mountains'
  const matrix = new THREE.Matrix4()
  cells.forEach((cell, index) => {
    const centre = cellCentre(cell.x, cell.y, size)
    matrix.makeTranslation(centre.x, GROUND_BASE + STANDIN_HEIGHT / 2, centre.z)
    mesh.setMatrixAt(index, matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

/** One kind of ground turned into geometry: the tops you walk on and the kerbs that close them. */
class Surface {
  #grid: Grid
  #kind: CellKind
  #cell: number
  #top: number
  #quads = new QuadMesh()

  constructor(world: World, kind: CellKind) {
    this.#grid = world.grid
    this.#kind = kind
    this.#cell = world.cellSize
    this.#top = groundTop(kind)
  }

  geometry(): THREE.BufferGeometry | undefined {
    for (const rect of this.#rects()) this.#addTop(rect)
    for (const side of SIDES) this.#addKerbs(side)
    return this.#quads.empty ? undefined : this.#quads.geometry()
  }

  /** The flat face you walk on, wound anticlockwise seen from above so it looks up. */
  #addTop(rect: Rect): void {
    const y = this.#top
    const x0 = rect.x * this.#cell
    const x1 = (rect.x + rect.w) * this.#cell
    const z0 = rect.y * this.#cell
    const z1 = (rect.y + rect.h) * this.#cell
    this.#quads.add(
      [
        { x: x0, y, z: z1, u: x0, v: z1 },
        { x: x1, y, z: z1, u: x1, v: z1 },
        { x: x1, y, z: z0, u: x1, v: z0 },
        { x: x0, y, z: z0, u: x0, v: z0 },
      ],
      { x: 0, y: 1, z: 0 },
    )
  }

  /**
   * The kerb down one side of the surface. Every run of cells that drops to
   * the same height becomes one quad, so a whole block of pavement costs four.
   */
  #addKerbs(side: Side): void {
    // north and south faces run along x, east and west faces along z
    const alongX = side.x === 0
    const lines = alongX ? this.#grid.height : this.#grid.width
    const cells = alongX ? this.#grid.width : this.#grid.height
    // a face looking north or west stands on the cell's own edge, one looking south or east on the next
    const at = (line: number) => (line + Math.max(side.x + side.z, 0)) * this.#cell

    for (let line = 0; line < lines; line++) {
      let from = -1
      let base = 0
      for (let i = 0; i <= cells; i++) {
        const drop = i < cells ? this.#dropBeside(alongX ? i : line, alongX ? line : i, side) : undefined
        if (from >= 0 && drop !== base) {
          this.#addKerb({ alongX, side, at: at(line), from: from * this.#cell, to: i * this.#cell, base })
          from = -1
        }
        if (drop !== undefined && from < 0) {
          from = i
          base = drop
        }
      }
    }
  }

  /** How far the ground beside this cell falls away, or nothing when it does not. */
  #dropBeside(x: number, y: number, side: Side): number | undefined {
    if (this.#grid.at(x, y) !== this.#kind) return undefined
    return dropTo(this.#top, this.#grid.at(x + side.x, y + side.z))
  }

  /** One vertical face, wound anticlockwise seen from the low side so the kerb reads from the road. */
  #addKerb(run: Run): void {
    // the tangent that turns into this normal runs +x on a south face and +z on a west face
    const forward = run.alongX ? run.side.z > 0 : run.side.x < 0
    const start = forward ? run.from : run.to
    const end = forward ? run.to : run.from
    const corner = (along: number, y: number): Corner =>
      run.alongX ? { x: along, y, z: run.at, u: along, v: y } : { x: run.at, y, z: along, u: along, v: y }

    this.#quads.add(
      [corner(start, run.base), corner(end, run.base), corner(end, this.#top), corner(start, this.#top)],
      { x: run.side.x, y: 0, z: run.side.z },
    )
  }

  /**
   * The cells of this kind as few rectangles: run right while the row matches,
   * then down while whole rows match. A block of pavement comes out as a
   * couple of quads instead of one per cell.
   */
  #rects(): Rect[] {
    const { width, height } = this.#grid
    const taken = new Uint8Array(width * height)
    const free = (x: number, y: number) => !taken[y * width + x] && this.#grid.at(x, y) === this.#kind
    const rects: Rect[] = []

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!free(x, y)) continue

        let w = 1
        while (x + w < width && free(x + w, y)) w++
        const rowFree = (row: number) => {
          for (let i = 0; i < w; i++) if (!free(x + i, row)) return false
          return true
        }
        let h = 1
        while (y + h < height && rowFree(y + h)) h++

        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) taken[(y + dy) * width + x + dx] = 1
        }
        rects.push({ x, y, w, h })
      }
    }
    return rects
  }
}

/** A stretch of one side of a surface that all drops to the same height. */
interface Run {
  readonly alongX: boolean
  readonly side: Side
  readonly at: number
  readonly from: number
  readonly to: number
  readonly base: number
}
