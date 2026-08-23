import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Forge, MOUNTAIN_CELLS, OfflineNarrator, STREET_CELLS } from '../src/index.ts'

/** The town as it stood before the roads out were built, recorded once. */
const RECORDED = JSON.parse(readFileSync(new URL('./fixtures/town.json', import.meta.url), 'utf8')) as {
  brief: Record<string, unknown>
  grid: string[]
  roads: { nodes: RoadNode[]; segments: RoadSegment[] }
  digests: Record<string, string>
  idCounters: Record<string, number>
}

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

const HALF = Math.floor(STREET_CELLS / 2)

async function town(overrides: Record<string, unknown> = {}) {
  const brief = { ...RECORDED.brief, ...overrides }
  const forge = new Forge(new OfflineNarrator(String(brief.seed)))
  const built = await forge.build(brief)
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 800))
  return built.value
}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32)

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
  it('carries every road out in the graph, joined to the street grid and marked as the way out', async () => {
    const { world } = await town({ exits: 4 })
    const roads = roadsOut(world)
    const { width, height } = world.grid

    expect(roads).toHaveLength(4)
    for (const road of roads) {
      expect(road.segment.lanes).toBe(2)
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

  it('is a road, not a strip: roadway the whole way, pavement each side, and no pavement left across it', async () => {
    const { world } = await town({ exits: 4 })
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
        for (const side of [HALF + 1, -(HALF + 1)]) {
          const kerb = beside(cell, road.junction, road.edge, side)
          expect(world.grid.at(kerb.x, kerb.y), `pavement at ${kerb.x},${kerb.y}`).toBe('sidewalk')
        }
      }
      // and stops short of the edge, so the road runs off the map instead of ending in two kerbs
      for (const side of [HALF + 1, -(HALF + 1)]) {
        const past = beside(road.edge, road.junction, road.edge, side)
        expect(world.grid.at(past.x, past.y), `beyond the pavement at ${past.x},${past.y}`).not.toBe('sidewalk')
      }
    }
  })

  it('can be walked out of town, pavement all the way to the last cell of it', async () => {
    const { world } = await town({ exits: 4 })
    const centre = { x: Math.floor(world.grid.width / 2), y: Math.floor(world.grid.height / 2) }
    const reached = walkableFrom(world, centre)
    const roads = roadsOut(world)
    expect(roads).toHaveLength(4)

    for (const road of roads) {
      const last = centreline(road.junction, road.edge).at(-2)!
      expect(reached.has(`${road.edge.x},${road.edge.y}`), `roadway at the edge on the ${road.segment.id} road`).toBe(true)
      for (const side of [HALF + 1, -(HALF + 1)]) {
        const kerb = beside(last, road.junction, road.edge, side)
        expect(reached.has(`${kerb.x},${kerb.y}`), `pavement at ${kerb.x},${kerb.y}`).toBe(true)
      }
    }
  })

  it('leaves the rest of the city exactly where it was', async () => {
    const { world, quests } = await town()
    const doc = world.toJSON() as unknown as {
      grid: { width: number; height: number; rows: string[] }
      roads: { nodes: RoadNode[]; segments: RoadSegment[] }
      idCounters: Record<string, number>
    } & Record<string, unknown>

    for (const part of ['plots', 'interiors', 'npcs', 'items', 'placements']) {
      expect(digest(doc[part]), part).toBe(RECORDED.digests[part])
    }
    expect(digest(quests), 'quests').toBe(RECORDED.digests.quests)

    // ids did not shift: only the graph's own counters moved on
    for (const [kind, count] of Object.entries(RECORDED.idCounters)) {
      if (kind === 'node' || kind === 'road') continue
      expect(doc.idCounters[kind], kind).toBe(count)
    }

    // the street graph is the graph it was, with the road out hung on the end
    expect(doc.roads.nodes.slice(0, RECORDED.roads.nodes.length)).toEqual(RECORDED.roads.nodes)
    expect(doc.roads.segments.slice(0, RECORDED.roads.segments.length)).toEqual(RECORDED.roads.segments)
    expect(doc.roads.nodes).toHaveLength(RECORDED.roads.nodes.length + 1)
    expect(doc.roads.segments).toHaveLength(RECORDED.roads.segments.length + 1)

    // and the only cells that changed are the road out through the mountain ring
    const changed: Array<{ cell: Cell; was: string; now: string }> = []
    doc.grid.rows.forEach((row, y) => {
      const before = RECORDED.grid[y]!
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== before[x]) changed.push({ cell: { x, y }, was: before[x]!, now: row[x]! })
      }
    })
    const tally: Record<string, number> = {}
    for (const change of changed) tally[`${change.was}->${change.now}`] = (tally[`${change.was}->${change.now}`] ?? 0) + 1
    expect(tally).toEqual({ 'W->S': STREET_CELLS, 'M->W': (MOUNTAIN_CELLS - 1) * 2 })

    const toEdge = (cell: Cell) => Math.min(cell.x, cell.y, doc.grid.width - 1 - cell.x, doc.grid.height - 1 - cell.y)
    for (const change of changed) expect(toEdge(change.cell), `${change.cell.x},${change.cell.y}`).toBeLessThanOrEqual(MOUNTAIN_CELLS)
  })
})
