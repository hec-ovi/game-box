import { cellCentre, METRICS, type CellKind, type Grid, type Rect, type World } from '@gb/world'
import * as THREE from 'three'
import type { Dressing } from './dressing.ts'
import { QuadMesh, type Corner } from './quads.ts'

/** The surfaces the city floor is made of. Mountains are blocks, not ground, and get their own mesh. */
export const GROUND_KINDS: readonly CellKind[] = ['street', 'sidewalk', 'park', 'building', 'empty', 'water']

/** Pavement and parks stand a kerb above the roadway; roads, land and water are at zero. */
const RAISED = new Set<CellKind>(['sidewalk', 'park'])

/** How deep the ground is buried where the world ends, and where the mountains start. */
const GROUND_BASE = -2
const MOUNTAIN_HEIGHT = 26

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
  if (kind === 'mountain') return GROUND_BASE + MOUNTAIN_HEIGHT
  return RAISED.has(kind) ? METRICS.street.curbHeight : 0
}

/**
 * One mesh for a whole surface: the top merged into as few quads as the grid
 * allows, plus a kerb face wherever it stands above what is beside it. A city
 * of thousands of cells stays a handful of draws and has no seam you can see
 * under.
 */
export function groundMesh(world: World, kind: CellKind, dressing: Dressing): THREE.Mesh | undefined {
  const cell = world.cellSize
  const top = groundTop(kind)
  const quads = new QuadMesh()

  for (const rect of mergedRects(world.grid, kind)) addTop(quads, rect, top, cell)
  for (const side of SIDES) addKerbs(quads, world.grid, kind, top, cell, side)
  if (quads.empty) return undefined

  const mesh = new THREE.Mesh(quads.geometry(), dressing.ground(kind))
  mesh.name = `ground:${kind}`
  mesh.receiveShadow = true
  return mesh
}

/** The ring that closes the valley, as one instanced block per mountain cell. */
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
    new THREE.BoxGeometry(size, MOUNTAIN_HEIGHT, size),
    dressing.ground('mountain'),
    cells.length,
  )
  mesh.name = 'mountains'
  const matrix = new THREE.Matrix4()
  cells.forEach((cell, index) => {
    const centre = cellCentre(cell.x, cell.y, size)
    matrix.makeTranslation(centre.x, GROUND_BASE + MOUNTAIN_HEIGHT / 2, centre.z)
    mesh.setMatrixAt(index, matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

/** The flat face you walk on, wound anticlockwise seen from above so it looks up. */
function addTop(quads: QuadMesh, rect: Rect, y: number, cell: number): void {
  const x0 = rect.x * cell
  const x1 = (rect.x + rect.w) * cell
  const z0 = rect.y * cell
  const z1 = (rect.y + rect.h) * cell
  quads.add(
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
 * The kerb down one side of the surface. Every run of cells that drops to the
 * same height becomes one quad, so a whole block of pavement costs four.
 */
function addKerbs(quads: QuadMesh, grid: Grid, kind: CellKind, top: number, cell: number, side: Side): void {
  // north and south faces run along x, east and west faces along z
  const alongX = side.x === 0
  const lines = alongX ? grid.height : grid.width
  const cells = alongX ? grid.width : grid.height
  // the boundary is on the near edge of the cell looking back, the far edge looking on
  const at = (line: number) => (line + Math.max(side.x + side.z, 0)) * cell

  for (let line = 0; line < lines; line++) {
    let from = -1
    let base = 0
    for (let i = 0; i <= cells; i++) {
      const drop = i < cells ? dropBeside(grid, alongX ? i : line, alongX ? line : i, kind, top, side) : undefined
      if (from >= 0 && drop !== base) {
        addKerb(quads, { alongX, at: at(line), from: from * cell, to: i * cell, base, top, side })
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
function dropBeside(grid: Grid, x: number, y: number, kind: CellKind, top: number, side: Side): number | undefined {
  if (grid.at(x, y) !== kind) return undefined
  const beside = groundTop(grid.at(x + side.x, y + side.z))
  return beside < top ? beside : undefined
}

interface Run {
  readonly alongX: boolean
  readonly at: number
  readonly from: number
  readonly to: number
  readonly base: number
  readonly top: number
  readonly side: Side
}

/** One vertical face, wound anticlockwise seen from the low side so the kerb reads from the road. */
function addKerb(quads: QuadMesh, run: Run): void {
  // the tangent that turns into this normal runs +x on a south face and +z on a west face
  const forward = run.alongX ? run.side.z > 0 : run.side.x < 0
  const start = forward ? run.from : run.to
  const end = forward ? run.to : run.from
  const corner = (along: number, y: number): Corner =>
    run.alongX ? { x: along, y, z: run.at, u: along, v: y } : { x: run.at, y, z: along, u: along, v: y }

  quads.add(
    [corner(start, run.base), corner(end, run.base), corner(end, run.top), corner(start, run.top)],
    { x: run.side.x, y: 0, z: run.side.z },
  )
}

/**
 * The cells of one kind as few rectangles: run right while the row matches,
 * then down while whole rows match. A block of pavement comes out as a couple
 * of quads instead of one per cell.
 */
function mergedRects(grid: Grid, kind: CellKind): Rect[] {
  const taken = new Uint8Array(grid.width * grid.height)
  const free = (x: number, y: number) => !taken[y * grid.width + x] && grid.at(x, y) === kind
  const rects: Rect[] = []

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!free(x, y)) continue

      let w = 1
      while (x + w < grid.width && free(x + w, y)) w++
      const rowFree = (row: number) => {
        for (let i = 0; i < w; i++) if (!free(x + i, row)) return false
        return true
      }
      let h = 1
      while (y + h < grid.height && rowFree(y + h)) h++

      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) taken[(y + dy) * grid.width + x + dx] = 1
      }
      rects.push({ x, y, w, h })
    }
  }
  return rects
}
