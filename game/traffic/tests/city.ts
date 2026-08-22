import { World, type RoadSegment } from '@gb/world'

export interface Lattice {
  /** Junctions across and down. */
  readonly across: number
  readonly down: number
  /** Cells between one junction and the next. */
  readonly span: number
  readonly seed?: string
}

const STREET_CELLS = 3
const HALF = (STREET_CELLS - 1) / 2

/**
 * A city of streets and solid blocks, painted the way the generator paints one:
 * roadway three cells across, a cell of pavement each side, buildings between.
 * Built here rather than generated so these tests own every number in them.
 */
export function lattice({ across, down, span, seed = 'traffic-test' }: Lattice): World {
  const margin = 4
  const width = margin * 2 + (across - 1) * span + 1
  const height = margin * 2 + (down - 1) * span + 1
  const world = World.create({ name: 'Testville', theme: 'test', seed, width, height })

  world.paint({ x: 0, y: 0, w: width, h: height }, 'building')
  const columns = axis(across, span, margin)
  const rows = axis(down, span, margin)
  const strips = [
    ...columns.map((x) => ({ x: x - HALF, y: 0, w: STREET_CELLS, h: height })),
    ...rows.map((y) => ({ x: 0, y: y - HALF, w: width, h: STREET_CELLS })),
  ]
  // pavements first, roadway second, so a crossing is roadway all the way through
  for (const strip of strips) world.paint({ ...strip, x: strip.x - 1, y: strip.y - 1, w: strip.w + 2, h: strip.h + 2 }, 'sidewalk')
  for (const strip of strips) world.paint(strip, 'street')

  const nodes = []
  const segments: RoadSegment[] = []
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < columns.length; i++) {
      nodes.push({ id: id(i, j), cell: { x: columns[i]!, y: rows[j]! } })
      if (i > 0) segments.push(street(`road_${j}_${i}_h`, id(i - 1, j), id(i, j)))
      if (j > 0) segments.push(street(`road_${j}_${i}_v`, id(i, j - 1), id(i, j)))
    }
  }
  world.addRoad(nodes, segments)
  return world
}

function axis(count: number, span: number, margin: number): number[] {
  return Array.from({ length: count }, (_, i) => margin + i * span)
}

function id(i: number, j: number): string {
  return `node_${String(j * 100 + i).padStart(4, '0')}`
}

function street(id: string, from: string, to: string): RoadSegment {
  return { id, from, to, kind: 'street', lanes: 2 }
}
