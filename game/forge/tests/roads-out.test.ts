import { cellRows, type GridField, type World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { BANDS, MOUNTAIN_CELLS } from '../src/index.ts'
import { digest, planned } from './support.ts'

interface Cell {
  x: number
  y: number
}
interface RoadNode {
  id: string
  cell: Cell
}
interface RoadSegment {
  id: string
  from: string
  to: string
  kind: string
  lanes: number
}

/** The road out is its own width: half of it either side of the centreline. */
const HALF = BANDS.exit.halfRoadway
/** And its pavement runs from the first cell past the kerb to the last. */
const KERB = [HALF + 1, HALF + BANDS.exit.pavement]

const town = (overrides: Record<string, unknown> = {}) => planned('town', overrides)

interface CityDoc extends Record<string, unknown> {
  grid: GridField
  roads: { nodes: RoadNode[]; segments: RoadSegment[] }
  idCounters: Record<string, number>
}

/** Every road out, read back off the graph the way another box would read it. */
function roadsOut(world: World) {
  const { nodes, segments } = world.toJSON().roads as { nodes: RoadNode[]; segments: RoadSegment[] }
  const cellOf = (id: string) => nodes.find((node) => node.id === id)!.cell
  return segments
    .filter((segment) => segment.kind === 'exit')
    .map((segment) => ({
      segment,
      junction: cellOf(segment.from),
      edge: cellOf(segment.to),
      joinsAStreet: segments.some((other) => other.kind === 'street' && (other.from === segment.from || other.to === segment.from)),
    }))
}

/** The cells the road runs through, from the junction out to the map edge. */
function centreline(junction: Cell, edge: Cell): Cell[] {
  const step = { x: Math.sign(edge.x - junction.x), y: Math.sign(edge.y - junction.y) }
  const length = Math.abs(edge.x - junction.x) + Math.abs(edge.y - junction.y)
  return Array.from({ length: length + 1 }, (_, i) => ({ x: junction.x + step.x * i, y: junction.y + step.y * i }))
}

/** A cell `n` cells to one side of the road, across its direction of travel. */
function beside(cell: Cell, junction: Cell, edge: Cell, n: number): Cell {
  return edge.x === junction.x ? { x: cell.x + n, y: cell.y } : { x: cell.x, y: cell.y + n }
}

/** Cells you can stand on, spreading from one cell over pavement and roadway only. */
function walkableFrom(world: World, start: Cell): Set<string> {
  const seen = new Set<string>()
  const queue: Cell[] = [start]
  while (queue.length) {
    const cell = queue.pop()!
    const key = `${cell.x},${cell.y}`
    if (seen.has(key)) continue
    const kind = world.grid.at(cell.x, cell.y)
    if (kind !== 'street' && kind !== 'sidewalk') continue
    seen.add(key)
    queue.push({ x: cell.x + 1, y: cell.y }, { x: cell.x - 1, y: cell.y }, { x: cell.x, y: cell.y + 1 }, { x: cell.x, y: cell.y - 1 })
  }
  return seen
}

describe('the roads out of the valley', () => {
  it('carries every road out in the graph, joined to the street grid and marked as the way out', () => {
    const world = town({ exits: 4 })
    const roads = roadsOut(world)
    const { width, height } = world.grid

    expect(roads).toHaveLength(4)
    for (const road of roads) {
      // two lanes each way: the road out is the widest in the valley
      expect(road.segment.lanes).toBe(4)
      // it leaves from a crossing the town's own streets meet at, not from an orphan node
      expect(road.joinsAStreet).toBe(true)
      // and it ends on the edge of the map
      expect(road.edge.x === 0 || road.edge.x === width - 1 || road.edge.y === 0 || road.edge.y === height - 1).toBe(true)
      // straight: it never turns between the two
      expect(road.edge.x === road.junction.x || road.edge.y === road.junction.y).toBe(true)
    }
    // the four go out on four different sides
    expect(new Set(roads.map((r) => `${Math.sign(r.edge.x - r.junction.x)},${Math.sign(r.edge.y - r.junction.y)}`)).size).toBe(4)
  })

  it('is a road, not a strip: roadway the whole way, pavement each side, and no pavement left across it', () => {
    const world = town({ exits: 4 })
    const roads = roadsOut(world)
    expect(roads).toHaveLength(4)

    for (const road of roads) {
      const cells = centreline(road.junction, road.edge)
      for (const cell of cells) {
        for (let n = -HALF; n <= HALF; n++) {
          const on = beside(cell, road.junction, road.edge, n)
          expect(world.grid.at(on.x, on.y), `roadway at ${on.x},${on.y}`).toBe('street')
        }
      }
      // pavement runs alongside from the mountain ring to a cell short of the edge
      const alongside = cells.slice(-MOUNTAIN_CELLS, -1)
      expect(alongside).toHaveLength(MOUNTAIN_CELLS - 1)
      for (const cell of alongside) {
        for (const side of [...KERB, ...KERB.map((n) => -n)]) {
          const kerb = beside(cell, road.junction, road.edge, side)
          expect(world.grid.at(kerb.x, kerb.y), `pavement at ${kerb.x},${kerb.y}`).toBe('sidewalk')
        }
      }
      // and stops short of the edge, so the road runs off the map instead of ending in two kerbs
      for (const side of [...KERB, ...KERB.map((n) => -n)]) {
        const past = beside(road.edge, road.junction, road.edge, side)
        expect(world.grid.at(past.x, past.y), `beyond the pavement at ${past.x},${past.y}`).not.toBe('sidewalk')
      }
    }
  })

  it('can be walked out of town, pavement all the way to the last cell of it', () => {
    const world = town({ exits: 4 })
    const centre = { x: Math.floor(world.grid.width / 2), y: Math.floor(world.grid.height / 2) }
    const reached = walkableFrom(world, centre)
    const roads = roadsOut(world)
    expect(roads).toHaveLength(4)

    for (const road of roads) {
      const last = centreline(road.junction, road.edge).at(-2)!
      expect(reached.has(`${road.edge.x},${road.edge.y}`), `roadway at the edge on the ${road.segment.id} road`).toBe(true)
      for (const side of [...KERB, ...KERB.map((n) => -n)]) {
        const kerb = beside(last, road.junction, road.edge, side)
        expect(reached.has(`${kerb.x},${kerb.y}`), `pavement at ${kerb.x},${kerb.y}`).toBe(true)
      }
    }
  })

  it('leaves the rest of the city exactly where it was when more roads out are asked for', () => {
    const before = town({ exits: 1 }).toJSON() as unknown as CityDoc
    const after = town({ exits: 4 }).toJSON() as unknown as CityDoc

    // the town is the town: not a building moves when a road is added
    expect(digest(after.plots), 'plots').toBe(digest(before.plots))

    // ids did not shift: only the graph's own counters moved on
    for (const [kind, count] of Object.entries(before.idCounters)) {
      if (kind === 'node' || kind === 'road') continue
      expect(after.idCounters[kind], kind).toBe(count)
    }

    // the street graph is the graph it was, with three more roads hung on the end
    expect(after.roads.nodes.slice(0, before.roads.nodes.length)).toEqual(before.roads.nodes)
    expect(after.roads.segments.slice(0, before.roads.segments.length)).toEqual(before.roads.segments)
    expect(after.roads.nodes).toHaveLength(before.roads.nodes.length + 3)
    expect(after.roads.segments).toHaveLength(before.roads.segments.length + 3)

    // and the only cells that changed are out in the mountain ring, plus the
    // pavement of the ring road where the mouth of the new road cuts through it
    const reach = MOUNTAIN_CELLS + BANDS.street.pavement
    const toEdge = (cell: Cell) => Math.min(cell.x, cell.y, after.grid.width - 1 - cell.x, after.grid.height - 1 - cell.y)
    const was = cellRows(before.grid)
    cellRows(after.grid).forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === was[y]![x]) continue
        expect(toEdge({ x, y }), `${x},${y}`).toBeLessThanOrEqual(reach)
      }
    })
  })
})
