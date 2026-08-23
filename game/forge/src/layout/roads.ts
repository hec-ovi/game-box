import { METRICS, type RoadKind, type World } from '@gb/world'
import type { Cell } from './bands.ts'
import type { ExitRoad } from './exits.ts'
import type { Junction } from './plan.ts'

type Segment = Parameters<World['addRoad']>[1][number]

interface Node {
  readonly id: string
  readonly at: Junction
}

/**
 * The drivable graph: a node at every street crossing joined to its neighbours
 * along each row and column, plus a node where each road out leaves the map,
 * hung off the crossing it leaves from so a car can drive the whole way.
 *
 * A segment carries the class of the band it runs down, so whoever drives it or
 * draws it can tell an avenue from a street without measuring the grid.
 */
export function layRoads(world: World, crossings: readonly Junction[], exits: readonly ExitRoad[]): void {
  const junctions: Node[] = crossings.map((at) => ({ id: world.mintId('node'), at }))
  const nodes = junctions.map((node) => ({ id: node.id, cell: node.at.cell }))
  const segments: Segment[] = streetsBetween(world, junctions)

  for (const exit of exits) {
    const from = junctions.find((node) => node.at.cell.x === exit.junction.x && node.at.cell.y === exit.junction.y)
    if (!from) continue
    const edge = { id: world.mintId('node'), cell: exit.edge }
    nodes.push(edge)
    segments.push(joining(world, from.id, edge.id, 'exit'))
  }

  world.addRoad(nodes, segments)
}

/** Joins each crossing to the next one along its row and its column, and no further. */
function streetsBetween(world: World, junctions: readonly Node[]): Segment[] {
  const segments: Segment[] = []
  for (const from of junctions) {
    for (const to of junctions) {
      const a = from.at.cell
      const b = to.at.cell
      const sameRow = a.y === b.y && b.x > a.x
      const sameColumn = a.x === b.x && b.y > a.y
      if (!sameRow && !sameColumn) continue
      if (between(junctions, a, b, sameRow)) continue
      // a segment along a row runs down that row's band, and along a column down the column's
      segments.push(joining(world, from.id, to.id, sameRow ? from.at.row.kind : from.at.column.kind))
    }
  }
  return segments
}

/** Is there another crossing between these two, on the same line? */
function between(junctions: readonly Node[], a: Cell, b: Cell, sameRow: boolean): boolean {
  return junctions.some(({ at: { cell } }) =>
    sameRow ? cell.y === a.y && cell.x > a.x && cell.x < b.x : cell.x === a.x && cell.y > a.y && cell.y < b.y,
  )
}

/** One segment, carrying the lanes its class of road holds. */
function joining(world: World, from: string, to: string, kind: RoadKind): Segment {
  return { id: world.mintId('road'), from, to, kind, lanes: METRICS.road[kind].lanes }
}
