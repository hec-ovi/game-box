import type { District, Rect } from '@gb/world'

/** One border line of a district, in grid cells: the two ends of a straight run. */
export interface Edge {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

/** A district as a shape: the blocks it holds, the line round them, and where its name goes. */
export interface Shape {
  readonly blocks: readonly Rect[]
  readonly border: readonly Edge[]
  readonly heart: { readonly x: number; readonly y: number }
}

/**
 * The shape a district actually is.
 *
 * This is the derivation `@gb/hud`'s map draws its districts with, in grid
 * coordinates rather than as an SVG path, because a blueprint needs line
 * geometry: the cells the district covers, then every cell edge facing a cell
 * it does not, then the runs along one line joined back up. The blocks a city
 * is cut into are not all the same size, so the edges of two that touch do not
 * line up end to end and cannot be cancelled against each other; working on the
 * grid is what makes an L, a Z or a T read as one region with one border.
 */
export function shapeOf(district: District): Shape {
  return { blocks: district.blocks, border: borderOf(district.blocks), heart: heartOf(district.blocks) }
}

/** Where a district's name is written: the middle of its largest block, which is inside the shape whatever shape it is. */
function heartOf(blocks: readonly Rect[]): { x: number; y: number } {
  let widest: Rect | undefined
  for (const block of blocks) if (!widest || block.w * block.h > widest.w * widest.h) widest = block
  if (!widest) return { x: 0, y: 0 }
  return { x: widest.x + widest.w / 2, y: widest.y + widest.h / 2 }
}

/** A run of cell edges along one line: which line, and where along it the run starts and ends. */
interface Run {
  readonly along: number
  from: number
  to: number
}

function borderOf(blocks: readonly Rect[]): Edge[] {
  const covered = cellsOf(blocks)
  if (covered.size === 0) return []
  const has = (x: number, y: number): boolean => covered.has(`${x},${y}`)

  const top: Run[] = []
  const bottom: Run[] = []
  const left: Run[] = []
  const right: Run[] = []
  for (const cell of covered) {
    const [x, y] = cell.split(',').map(Number) as [number, number]
    if (!has(x, y - 1)) top.push({ along: y, from: x, to: x + 1 })
    if (!has(x, y + 1)) bottom.push({ along: y + 1, from: x, to: x + 1 })
    if (!has(x - 1, y)) left.push({ along: x, from: y, to: y + 1 })
    if (!has(x + 1, y)) right.push({ along: x + 1, from: y, to: y + 1 })
  }

  const border: Edge[] = []
  for (const runs of [top, bottom]) {
    for (const run of joined(runs)) border.push({ x1: run.from, y1: run.along, x2: run.to, y2: run.along })
  }
  for (const runs of [left, right]) {
    for (const run of joined(runs)) border.push({ x1: run.along, y1: run.from, x2: run.along, y2: run.to })
  }
  return border
}

/** Runs on the same line that touch end to end, joined into one. */
function joined(runs: Run[]): Run[] {
  runs.sort((one, other) => one.along - other.along || one.from - other.from)
  const merged: Run[] = []
  for (const run of runs) {
    const last = merged[merged.length - 1]
    if (last && last.along === run.along && last.to === run.from) last.to = run.to
    else merged.push({ ...run })
  }
  return merged
}

/** Which cells the blocks cover, keyed by their grid coordinates. */
function cellsOf(blocks: readonly Rect[]): Set<string> {
  const covered = new Set<string>()
  for (const block of blocks) {
    const fromX = Math.floor(block.x)
    const fromY = Math.floor(block.y)
    const toX = Math.ceil(block.x + block.w)
    const toY = Math.ceil(block.y + block.h)
    for (let y = fromY; y < toY; y++) {
      for (let x = fromX; x < toX; x++) covered.add(`${x},${y}`)
    }
  }
  return covered
}
