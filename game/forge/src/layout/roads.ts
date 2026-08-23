import type { World } from '@gb/world'
import type { Cell } from './bands.ts'
import type { ExitRoad } from './exits.ts'

type Segment = Parameters<World['addRoad']>[1][number]

interface Node {
  readonly id: string
  readonly cell: Cell
}

/**
 * The drivable graph: a node at every street crossing joined to its neighbours
 * along each row and column, plus a node where each road out leaves the map,
 * hung off the crossing it leaves from so a car can drive the whole way.
 */
export function layRoads(world: World, crossings: readonly Cell[], exits: readonly ExitRoad[]): void {
  const junctions: Node[] = crossings.map((cell) => ({ id: world.mintId('node'), cell }))
  const nodes: Node[] = [...junctions]
  const segments: Segment[] = streetsBetween(world, junctions)

  for (const exit of exits) {
    const from = junctions.find((node) => node.cell.x === exit.junction.x && node.cell.y === exit.junction.y)
    if (!from) continue
    const edge: Node = { id: world.mintId('node'), cell: exit.edge }
    nodes.push(edge)
    segments.push({ id: world.mintId('road'), from: from.id, to: edge.id, kind: 'exit', lanes: 2 })
  }

  world.addRoad(nodes, segments)
}

/** Joins each crossing to the next one along its row and its column, and no further. */
function streetsBetween(world: World, junctions: readonly Node[]): Segment[] {
  const segments: Segment[] = []
  for (const from of junctions) {
    for (const to of junctions) {
      const sameRow = from.cell.y === to.cell.y && to.cell.x > from.cell.x
      const sameColumn = from.cell.x === to.cell.x && to.cell.y > from.cell.y
      if (!sameRow && !sameColumn) continue
      const between = junctions.some(
        (other) =>
          other !== from &&
          other !== to &&
          ((sameRow && other.cell.y === from.cell.y && other.cell.x > from.cell.x && other.cell.x < to.cell.x) ||
            (sameColumn && other.cell.x === from.cell.x && other.cell.y > from.cell.y && other.cell.y < to.cell.y)),
      )
      if (between) continue
      segments.push({ id: world.mintId('road'), from: from.id, to: to.id, kind: 'street', lanes: 2 })
    }
  }
  return segments
}
