import { svg } from '../dom.ts'
import type { MapDistrict, MapRect } from '../types.ts'

/**
 * The parts of a city, drawn as the shapes they are.
 *
 * A district is a set of blocks, not a box, so its outline is every edge of
 * those blocks with nothing of the same district behind it. That is what makes
 * an L, a Z or a T read as one region with one border instead of a heap of
 * rectangles with lines through the middle of it.
 *
 * The blocks a city is cut into are not all the same size, so the edges of two
 * that touch do not line up end to end and cannot simply be cancelled against
 * each other. The shape is worked out on the grid instead: which cells the
 * district covers, then every cell edge that faces a cell it does not. The runs
 * along one line are joined back up, so the border of a district is a few dozen
 * lines rather than a few thousand.
 *
 * The fill and the outline are one path each, so a district of forty blocks is
 * two nodes and not eighty.
 */
export function districtShape(district: MapDistrict): SVGGElement {
  const node = svg('g', { class: 'gb-district', 'data-district': district.id })
  node.append(
    svg('path', { class: 'gb-district-fill', d: fillOf(district.rects) }),
    svg('path', { class: 'gb-district-edge', d: outlineOf(district.rects) }),
  )
  return node
}

/** Where a district's name is written: the middle of its largest block, which is inside the shape whatever shape it is. */
export function heartOf(district: MapDistrict): { x: number; y: number } {
  let widest: MapRect | undefined
  for (const rect of district.rects) if (!widest || rect.w * rect.h > widest.w * widest.h) widest = rect
  if (!widest) return { x: 0, y: 0 }
  return { x: widest.x + widest.w / 2, y: widest.y + widest.h / 2 }
}

/** Every block as its own subpath. Where they overlap makes no difference to a fill. */
function fillOf(rects: readonly MapRect[]): string {
  return rects.map((rect) => `M ${rect.x} ${rect.y} h ${rect.w} v ${rect.h} h ${-rect.w} Z`).join(' ')
}

/** A run of cell edges along one line, as the grid coordinates of its two ends. */
interface Run {
  readonly along: number
  from: number
  to: number
}

function outlineOf(rects: readonly MapRect[]): string {
  const covered = cellsOf(rects)
  if (covered.size === 0) return ''
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

  const lines: string[] = []
  for (const runs of [top, bottom]) {
    for (const run of joined(runs)) lines.push(`M ${run.from} ${run.along} H ${run.to}`)
  }
  for (const runs of [left, right]) {
    for (const run of joined(runs)) lines.push(`M ${run.along} ${run.from} V ${run.to}`)
  }
  return lines.join(' ')
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
function cellsOf(rects: readonly MapRect[]): Set<string> {
  const covered = new Set<string>()
  for (const rect of rects) {
    const fromX = Math.floor(rect.x)
    const fromY = Math.floor(rect.y)
    const toX = Math.ceil(rect.x + rect.w)
    const toY = Math.ceil(rect.y + rect.h)
    for (let y = fromY; y < toY; y++) {
      for (let x = fromX; x < toX; x++) covered.add(`${x},${y}`)
    }
  }
  return covered
}
