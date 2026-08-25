/**
 * Flat-ground geometry. One unit is one metre and Y is up, so a position on the
 * road is (x, z) and only the heading around Y matters.
 */

export interface Point {
  readonly x: number
  readonly z: number
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

/** Unit vector from `a` to `b`. Zero length gives (1, 0) so nothing can produce NaN. */
export function direction(a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz)
  return len === 0 ? { x: 1, z: 0 } : { x: dx / len, z: dz / len }
}

/** The driver's right hand side of a heading, for a Y-up scene. */
export function rightOf(dir: Point): Point {
  return { x: -dir.z, z: dir.x }
}

export function offsetBy(p: Point, dir: Point, metres: number): Point {
  return { x: p.x + dir.x * metres, z: p.z + dir.z * metres }
}

/** Rotation around Y for a model whose nose points down +Z. */
export function headingOf(dir: Point): number {
  return Math.atan2(dir.x, dir.z)
}

/**
 * Where two lines cross, given a point and a direction on each. Used to place
 * the control point of a turn so the curve leaves and enters along the lanes.
 * Parallel lines fall back to the midpoint, which keeps a degenerate junction
 * driveable instead of producing NaN.
 */
export function tangentCrossing(a: Point, da: Point, b: Point, db: Point): Point {
  const det = da.x * -db.z - da.z * -db.x
  if (Math.abs(det) < 1e-6) return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
  const t = ((b.x - a.x) * -db.z - (b.z - a.z) * -db.x) / det
  return offsetBy(a, da, t)
}

/**
 * A polyline a car drives along, measured in metres from its start. Lanes are
 * two points, turns through a junction are a sampled curve, and both answer the
 * same two questions: where am I, and which way am I pointing.
 */
export class Path {
  readonly points: readonly Point[]
  readonly length: number
  readonly #upto: Float64Array
  /** The box the path fits in, for a cheap answer to "could this point be anywhere near it". */
  readonly #minX: number
  readonly #maxX: number
  readonly #minZ: number
  readonly #maxZ: number

  constructor(points: readonly Point[]) {
    if (points.length < 2) throw new Error('a path needs at least two points')
    this.points = points
    this.#upto = new Float64Array(points.length)
    let total = 0
    for (let i = 1; i < points.length; i++) {
      total += distance(points[i - 1]!, points[i]!)
      this.#upto[i] = total
    }
    this.length = total
    this.#minX = Math.min(...points.map((p) => p.x))
    this.#maxX = Math.max(...points.map((p) => p.x))
    this.#minZ = Math.min(...points.map((p) => p.z))
    this.#maxZ = Math.max(...points.map((p) => p.z))
  }

  /** False when the point is further than `margin` from the box the path fits in, so nothing nearer needs measuring. */
  near(p: Point, margin: number): boolean {
    return p.x >= this.#minX - margin && p.x <= this.#maxX + margin && p.z >= this.#minZ - margin && p.z <= this.#maxZ + margin
  }

  static straight(from: Point, to: Point): Path {
    return new Path([from, to])
  }

  /** A quadratic curve, sampled into `steps` straight pieces. */
  static curve(from: Point, control: Point, to: Point, steps: number): Path {
    const points: Point[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const u = 1 - t
      points.push({
        x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
        z: u * u * from.z + 2 * u * t * control.z + t * t * to.z,
      })
    }
    return new Path(points)
  }

  pointAt(s: number): Point {
    const i = this.#pieceAt(s)
    const a = this.points[i]!
    const b = this.points[i + 1]!
    const start = this.#upto[i]!
    const span = this.#upto[i + 1]! - start
    const t = span === 0 ? 0 : (s - start) / span
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
  }

  /**
   * Where a point falls on this path: how far along, and how far off to the
   * side. This is how somebody standing in the street becomes a distance a
   * driver can brake against.
   */
  nearestTo(p: Point): { s: number; off: number } {
    let bestS = 0
    let bestOff = Number.POSITIVE_INFINITY
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i]!
      const b = this.points[i + 1]!
      const dx = b.x - a.x
      const dz = b.z - a.z
      const span = dx * dx + dz * dz
      const t = span === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / span))
      const off = Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t))
      if (off < bestOff) {
        bestOff = off
        bestS = this.#upto[i]! + t * Math.sqrt(span)
      }
    }
    return { s: bestS, off: bestOff }
  }

  directionAt(s: number): Point {
    const i = this.#pieceAt(s)
    return direction(this.points[i]!, this.points[i + 1]!)
  }

  #pieceAt(s: number): number {
    const clamped = Math.min(Math.max(s, 0), this.length)
    let lo = 0
    let hi = this.points.length - 2
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.#upto[mid]! <= clamped) lo = mid
      else hi = mid - 1
    }
    return lo
  }
}

/**
 * How far a point is from a rectangle `halfLength` ahead and behind `centre`
 * along `dir` and `halfWidth` either side of it. Zero inside. This is what a
 * car's footprint is to somebody standing next to it, tail and sides included.
 */
export function clearanceFrom(centre: Point, dir: Point, halfLength: number, halfWidth: number, p: Point): number {
  const dx = p.x - centre.x
  const dz = p.z - centre.z
  const along = Math.abs(dx * dir.x + dz * dir.z)
  const across = Math.abs(dx * dir.z - dz * dir.x)
  return Math.hypot(Math.max(0, along - halfLength), Math.max(0, across - halfWidth))
}
