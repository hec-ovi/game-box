import type { Plot } from '@gb/world'

/** The four walls, named by the world direction they look out on. */
export type FaceId = 'north' | 'east' | 'south' | 'west'

/**
 * One wall of a building, in the building's own frame (origin at the centre of
 * its base, x east, z south). Modules are numbered from the wall's left as you
 * look at it from outside, which is also where a piece's own +x ends up once
 * it is turned to face out.
 */
export interface Face {
  readonly id: FaceId
  /** How many modules fit across it. */
  readonly modules: number
  /** What one module actually gets, which is the module size unless the plot does not divide by it. */
  readonly moduleWidth: number
  readonly rotationY: number
  /** Centre of module `index` on the wall plane, as [x, z]. */
  centreOf(index: number): readonly [number, number]
  /** True for the walls whose modules run along the plot's x cells. */
  readonly acrossX: boolean
  /** Middle of the wall plane, as [x, z]. */
  readonly origin: readonly [number, number]
  /**
   * Unit vector along the wall, as [x, z], pointing the way the modules are
   * numbered: rightwards to somebody standing outside looking at it. The wall
   * looks out along `right` turned a quarter up, which is `[-z, x]`.
   */
  readonly right: readonly [number, number]
}

const HALF_TURN = Math.PI
const QUARTER = Math.PI / 2

/** Cuts the four walls of a `width` by `depth` box into modules of about `module` metres. */
export function facesOf(width: number, depth: number, module: number): Record<FaceId, Face> {
  const across = Math.max(1, Math.round(width / module))
  const along = Math.max(1, Math.round(depth / module))
  const [halfW, halfD] = [width / 2, depth / 2]
  const [stepX, stepZ] = [width / across, depth / along]

  return {
    north: { id: 'north', acrossX: true, modules: across, moduleWidth: stepX, rotationY: HALF_TURN, origin: [0, -halfD], right: [-1, 0], centreOf: (i) => [halfW - (i + 0.5) * stepX, -halfD] },
    east: { id: 'east', acrossX: false, modules: along, moduleWidth: stepZ, rotationY: QUARTER, origin: [halfW, 0], right: [0, -1], centreOf: (i) => [halfW, halfD - (i + 0.5) * stepZ] },
    south: { id: 'south', acrossX: true, modules: across, moduleWidth: stepX, rotationY: 0, origin: [0, halfD], right: [1, 0], centreOf: (i) => [-halfW + (i + 0.5) * stepX, halfD] },
    west: { id: 'west', acrossX: false, modules: along, moduleWidth: stepZ, rotationY: -QUARTER, origin: [-halfW, 0], right: [0, 1], centreOf: (i) => [-halfW, -halfD + (i + 0.5) * stepZ] },
  }
}

/**
 * Which wall the front door is on. The entrance cell is the pavement doorstep,
 * so where it sits against the footprint answers this on its own; the plot's
 * own `facing` settles it when the cell is inside the footprint.
 */
export function entranceFace(plot: Plot): FaceId {
  const { rect, entrance } = plot
  const gaps: [FaceId, number][] = [
    ['west', rect.x - entrance.cell.x],
    ['east', entrance.cell.x - (rect.x + rect.w - 1)],
    ['north', rect.y - entrance.cell.y],
    ['south', entrance.cell.y - (rect.y + rect.h - 1)],
  ]
  const outside = gaps.filter(([, gap]) => gap > 0).sort((a, b) => b[1] - a[1])[0]
  return outside ? outside[0] : entrance.facing
}

/**
 * Which module of that wall the door goes in: the one nearest the doorstep, so
 * the door and the pavement the scene sends the player to line up.
 */
export function doorModule(plot: Plot, face: Face, cellSize: number): number {
  const { rect, entrance } = plot
  const target = face.acrossX
    ? (entrance.cell.x + 0.5 - rect.x - rect.w / 2) * cellSize
    : (entrance.cell.y + 0.5 - rect.y - rect.h / 2) * cellSize
  const axis = face.acrossX ? 0 : 1
  let best = 0
  for (let i = 1; i < face.modules; i++) {
    if (Math.abs(face.centreOf(i)[axis] - target) < Math.abs(face.centreOf(best)[axis] - target)) best = i
  }
  return best
}
