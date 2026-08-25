import { FixtureShape } from '../shape.ts'
import { SUBWAY, wellOf } from './design.ts'

const { well, parapet, back, step, apron, sign, material } = SUBWAY

/**
 * One subway entrance in its own frame: the walls either side of the well and
 * the back wall against the building, the steps going down between them to a
 * dark floor, the lip round the opening, and the housing over the back wall
 * the lit panel is drawn on. What shows over the pavement is the balustrade
 * and the sign; the steps show once the ground is open under the cell.
 */
export function subwayShape(cellSize: number): FixtureShape {
  const { width, length } = wellOf(cellSize)
  const half = cellSize / 2
  const t = well.wall
  const shape = new FixtureShape('subway entrance')

  // the walls: either side of the well, and across its far end against the building
  for (const side of [-1, 1]) shape.slab(material.wall, [t, well.depth + parapet, length + t], [side * (width + t) / 2, (parapet - well.depth) / 2, -t / 2])
  shape.slab(material.wall, [width + 2 * t, well.depth + back, t], [0, (back - well.depth) / 2, -(length + t) / 2])

  // the steps down from the mouth, each a block standing on the floor, and the floor under them
  for (let at = 0; ; at++) {
    const top = -(at + 1) * step.rise
    const tread = length / 2 - (at + 0.5) * step.go
    if (top <= -well.depth || tread - step.go / 2 < -length / 2) break
    shape.slab(material.step, [width, top + well.depth, step.go], [0, (top - well.depth) / 2, tread])
  }
  shape.slab(material.dark, [width, 0.05, length], [0, -well.depth - 0.025, 0])

  // the lip round the opening, out to the edge of the cell
  shape.slab(material.wall, [cellSize, apron, half - length / 2], [0, apron / 2, (half + length / 2) / 2])
  shape.slab(material.wall, [cellSize, apron, half - length / 2 - t], [0, apron / 2, -(half + length / 2 + t) / 2])
  for (const side of [-1, 1]) shape.slab(material.wall, [half - width / 2 - t, apron, length + t], [side * (half + width / 2 + t) / 2, apron / 2, -t / 2])

  // the housing over the back wall that carries the lit panel
  shape.slab(material.dark, [width + 2 * t, sign.height + 2 * sign.housing, sign.depth], [0, signCentre(), -(length + t) / 2])
  return shape
}

/** How high the middle of the sign sits. */
export function signCentre(): number {
  return back + sign.over + sign.housing + sign.height / 2
}
