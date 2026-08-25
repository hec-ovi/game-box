import { METRICS, World, type RoadNode, type RoadSegment } from '@gb/world'

export interface Lattice {
  /** Junctions across and down. */
  readonly across: number
  readonly down: number
  /** Cells between one junction and the next. */
  readonly span: number
  readonly seed?: string
  /** What the segments are. `exit` makes every dead end a road out of town. */
  readonly kind?: RoadSegment['kind']
}

/**
 * A city of streets and solid blocks, painted the way the generator paints one:
 * the roadway its class's own width, a cell of pavement each side, buildings
 * between. Built here rather than generated so these tests own every number in
 * them, and read off `METRICS.road` so a class that widens widens here too.
 */
export function lattice({ across, down, span, seed = 'traffic-test', kind = 'street' }: Lattice): World {
  const road = METRICS.road[kind]
  const cells = road.roadwayCells
  const half = (cells - 1) / 2
  const margin = half + 1
  const width = margin * 2 + (across - 1) * span + 1
  const height = margin * 2 + (down - 1) * span + 1
  const world = World.create({ name: 'Testville', theme: 'test', seed, width, height })

  world.paint({ x: 0, y: 0, w: width, h: height }, 'building')
  const columns = axis(across, span, margin)
  const rows = axis(down, span, margin)
  const strips = [
    ...columns.map((x) => ({ x: x - half, y: 0, w: cells, h: height })),
    ...rows.map((y) => ({ x: 0, y: y - half, w: width, h: cells })),
  ]
  // pavements first, roadway second, so a crossing is roadway all the way through
  for (const strip of strips) world.paint({ ...strip, x: strip.x - 1, y: strip.y - 1, w: strip.w + 2, h: strip.h + 2 }, 'sidewalk')
  for (const strip of strips) world.paint(strip, 'street')

  const nodes: RoadNode[] = []
  const segments: RoadSegment[] = []
  const join = (from: string, to: string) => segments.push({ id: roadId(segments.length), from, to, kind, lanes: road.lanes })
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < columns.length; i++) {
      nodes.push({ id: nodeId(i, j), cell: { x: columns[i]!, y: rows[j]! } })
      if (i > 0) join(nodeId(i - 1, j), nodeId(i, j))
      if (j > 0) join(nodeId(i, j - 1), nodeId(i, j))
    }
  }
  addRoad(world, nodes, segments)
  return world
}

/** `World.addRoad` for a fixture: a refused record is a broken fixture, so it throws. */
export function addRoad(world: World, nodes: readonly RoadNode[], segments: readonly RoadSegment[]): void {
  const added = world.addRoad(nodes, segments)
  if (!added.ok) throw new Error(`fixture road refused: ${JSON.stringify(added.error)}`)
}

function axis(count: number, span: number, margin: number): number[] {
  return Array.from({ length: count }, (_, i) => margin + i * span)
}

function nodeId(i: number, j: number): string {
  return `node_${String(j * 100 + i).padStart(4, '0')}`
}

function roadId(n: number): string {
  return `road_${String(n).padStart(4, '0')}`
}
