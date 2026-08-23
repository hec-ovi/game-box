import { cellCentre } from '@gb/world'
import type { Cell, Point } from './cells.ts'

/**
 * A route with its straight stretches collapsed, in metres: what an NPC
 * actually walks, instead of one waypoint per cell.
 */
export function waypoints(path: readonly Cell[], cellSize: number): Point[] {
  if (path.length === 0) return []
  const corners: Cell[] = [path[0]!]
  for (let i = 1; i < path.length - 1; i++) {
    const previous = path[i - 1]!
    const cell = path[i]!
    const next = path[i + 1]!
    const turned = cell.x - previous.x !== next.x - cell.x || cell.y - previous.y !== next.y - cell.y
    if (turned) corners.push(cell)
  }
  if (path.length > 1) corners.push(path[path.length - 1]!)
  return corners.map((cell) => cellCentre(cell.x, cell.y, cellSize))
}
