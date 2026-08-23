/**
 * The plan of a piece: a rectangle whose four corners each carry their own
 * radius, walked anticlockwise seen from above.
 *
 * This is the whole of the owner's "one side sharp, the other circular". A
 * square corner is one point carrying two normals, so it stays a crease; a
 * radiused one is an arc of points carrying a turning normal, so it reads
 * round. Everything in the catalog is an extrusion of one of these.
 */

/** Corner radii in metres, in the order the outline walks them: +x-z, -x-z, -x+z, +x+z. */
export type Corners = readonly [number, number, number, number]

export interface Rim {
  readonly x: number
  readonly z: number
  /** The outward normal in plan, unit length. */
  readonly nx: number
  readonly nz: number
}

const SQUARE = 1e-6

interface Turn {
  readonly cx: number
  readonly cz: number
  readonly r: number
  readonly from: number
}

/**
 * The rim of a rounded rectangle, half `halfW` across and `halfD` deep, in
 * order. A corner with no radius emits its point twice, once with each edge's
 * normal, which is what keeps it sharp when the sides are smoothed.
 */
export function outline(halfW: number, halfD: number, corners: Corners, arc: number): Rim[] {
  const limit = Math.min(halfW, halfD)
  const radii = corners.map((r) => Math.max(0, Math.min(r, limit))) as unknown as Corners
  const turns: Turn[] = [
    { cx: halfW - radii[0], cz: -(halfD - radii[0]), r: radii[0], from: 0 },
    { cx: -(halfW - radii[1]), cz: -(halfD - radii[1]), r: radii[1], from: Math.PI / 2 },
    { cx: -(halfW - radii[2]), cz: halfD - radii[2], r: radii[2], from: Math.PI },
    { cx: halfW - radii[3], cz: halfD - radii[3], r: radii[3], from: (3 * Math.PI) / 2 },
  ]

  const rim: Rim[] = []
  for (const turn of turns) {
    if (turn.r < SQUARE) {
      // the corner point itself, once for the edge arriving and once for the edge leaving
      const at = Math.cos(turn.from)
      const to = Math.cos(turn.from + Math.PI / 2)
      rim.push(point(turn, turn.from, at, -Math.sin(turn.from)))
      rim.push(point(turn, turn.from + Math.PI / 2, to, -Math.sin(turn.from + Math.PI / 2)))
      continue
    }
    for (let step = 0; step <= arc; step++) {
      const angle = turn.from + (Math.PI / 2) * (step / arc)
      rim.push(point(turn, angle, Math.cos(angle), -Math.sin(angle)))
    }
  }
  return rim
}

function point(turn: Turn, angle: number, nx: number, nz: number): Rim {
  return { x: turn.cx + turn.r * Math.cos(angle), z: turn.cz - turn.r * Math.sin(angle), nx, nz }
}

/** The same corners on every corner: the common case. */
export function everyCorner(radius: number): Corners {
  return [radius, radius, radius, radius]
}

/** Round the two corners a body approaches and leave the back square. */
export function frontCorners(radius: number): Corners {
  return [radius, radius, 0, 0]
}
