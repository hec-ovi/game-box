import type { MapDistrict, MapEdge, MapRect, MapShape } from '../types.ts'

/**
 * The shape a part of the city actually is.
 *
 * A district is a set of blocks, not a box, and the blocks of one district do
 * not touch: there is a street between every pair of them. So the shape is
 * worked out on the grid, with each block carried out by `grow` cells first,
 * which is half the street around it. Its blocks then meet in the middle of
 * their own streets and the district comes out as one region rather than as a
 * heap of outlined blocks, and two districts either side of one street stop
 * against each other.
 *
 * What comes back is that region as few rectangles as cover it, the line round
 * it (every cell edge facing a cell it does not hold, the runs along one line
 * joined) and where its name goes. An L, a Z or a T is one shape with one
 * border, whichever surface draws it.
 */
export function districtShape(district: MapDistrict, grow = 0): MapShape {
  const covered = cellsOf(district.rects, grow)
  return { rects: patchesOf(covered), border: borderOf(covered), heart: heartOf(district.rects) }
}

/** Where a district's name is written: the middle of its largest block, which is inside the shape whatever shape it is. */
function heartOf(rects: readonly MapRect[]): { x: number; y: number } {
  let widest: MapRect | undefined
  for (const rect of rects) if (!widest || rect.w * rect.h > widest.w * widest.h) widest = rect
  if (!widest) return { x: 0, y: 0 }
  return { x: widest.x + widest.w / 2, y: widest.y + widest.h / 2 }
}

/** A run of cell edges along one line: which line, and where along it the run starts and ends. */
interface Run {
  readonly along: number
  from: number
  to: number
}

function borderOf(covered: Set<string>): MapEdge[] {
  if (covered.size === 0) return []
  const has = (x: number, y: number): boolean => covered.has(`${x},${y}`)

  // every cell edge with a cell on one side and nothing on the other
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

  const border: MapEdge[] = []
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

/** Which cells the blocks cover once each is carried out by `grow`, keyed by their grid coordinates. */
function cellsOf(rects: readonly MapRect[], grow: number): Set<string> {
  const covered = new Set<string>()
  for (const rect of rects) {
    const fromX = Math.floor(rect.x) - grow
    const fromY = Math.floor(rect.y) - grow
    const toX = Math.ceil(rect.x + rect.w) + grow
    const toY = Math.ceil(rect.y + rect.h) + grow
    for (let y = fromY; y < toY; y++) {
      for (let x = fromX; x < toX; x++) covered.add(`${x},${y}`)
    }
  }
  return covered
}

/**
 * The region as few rectangles as cover it, and none of them overlapping.
 * Overlapping rectangles are the same region to look at and twice the paint
 * where they cross, which on anything drawn with an alpha is a seam.
 */
function patchesOf(covered: Set<string>): MapRect[] {
  if (covered.size === 0) return []
  const cells = [...covered].map((key) => key.split(',').map(Number) as [number, number])
  const taken = new Set<string>()
  const has = (x: number, y: number): boolean => covered.has(`${x},${y}`) && !taken.has(`${x},${y}`)
  const rects: MapRect[] = []
  for (const [x, y] of cells.sort((one, other) => one[1] - other[1] || one[0] - other[0])) {
    if (!has(x, y)) continue
    let right = x
    while (has(right + 1, y)) right++
    let bottom = y
    while (rowFree(has, x, right, bottom + 1)) bottom++
    for (let row = y; row <= bottom; row++) {
      for (let at = x; at <= right; at++) taken.add(`${at},${row}`)
    }
    rects.push({ x, y, w: right - x + 1, h: bottom - y + 1 })
  }
  return rects
}

function rowFree(has: (x: number, y: number) => boolean, from: number, to: number, y: number): boolean {
  for (let x = from; x <= to; x++) if (!has(x, y)) return false
  return true
}
