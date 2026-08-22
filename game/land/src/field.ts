import type { World } from '@gb/world'

const FAR = 1e12

/**
 * How far every point is from open ground, in metres.
 *
 * Open ground is the city's plain (every grid cell that is not `mountain`) plus
 * the roads that leave through the ring, carried on outwards so the exit stays
 * a pass and not a dead end. Terrain height is a function of this distance, so
 * the land is flat where the town and its road are and climbs away from them.
 */
export class OpenField {
  readonly step: number
  readonly originX: number
  readonly originZ: number
  readonly cols: number
  readonly rows: number
  /** Distance in metres from the nearest open point, one sample per field cell. */
  readonly #metres: Float64Array

  private constructor(step: number, originX: number, originZ: number, cols: number, rows: number, metres: Float64Array) {
    this.step = step
    this.originX = originX
    this.originZ = originZ
    this.cols = cols
    this.rows = rows
    this.#metres = metres
  }

  /**
   * Rasterise the grid's open cells, run the exits outward by `passLength`
   * metres, then measure every sample's distance to the nearest of them.
   */
  static of(world: World, options: { margin: number; step: number; passLength: number }): OpenField {
    const cell = world.cellSize
    const { width, height } = world.grid
    const step = options.step
    const originX = -Math.ceil(options.margin / step) * step
    const originZ = originX
    const cols = Math.ceil((width * cell - originX * 2) / step) + 1
    const rows = Math.ceil((height * cell - originZ * 2) / step) + 1

    const squared = new Float64Array(cols * rows).fill(FAR)
    const open = (x: number, z: number, w: number, h: number): void => {
      const c0 = Math.max(0, Math.floor((x - originX) / step))
      const c1 = Math.min(cols - 1, Math.ceil((x + w - originX) / step))
      const r0 = Math.max(0, Math.floor((z - originZ) / step))
      const r1 = Math.min(rows - 1, Math.ceil((z + h - originZ) / step))
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) squared[r * cols + c] = 0
      }
    }

    const pass = options.passLength
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (world.grid.at(x, y) === 'mountain') continue
        open(x * cell, y * cell, cell, cell)
        // a road that reaches the edge of the map keeps going: the valley has a
        // way out, and the hills part around it instead of burying it
        if (y === 0) open(x * cell, -pass, cell, pass)
        if (y === height - 1) open(x * cell, height * cell, cell, pass)
        if (x === 0) open(-pass, y * cell, pass, cell)
        if (x === width - 1) open(width * cell, y * cell, pass, cell)
      }
    }

    transform(squared, cols, rows)
    const metres = new Float64Array(cols * rows)
    for (let i = 0; i < metres.length; i++) metres[i] = Math.sqrt(squared[i]!) * step
    return new OpenField(step, originX, originZ, cols, rows, metres)
  }

  /** True when at least one sample is open ground, so there is a valley to grow land around. */
  hasOpenGround(): boolean {
    for (let i = 0; i < this.#metres.length; i++) if (this.#metres[i] === 0) return true
    return false
  }

  /** Metres from (x, z) to the nearest open ground. Grows without bound outside the sampled area. */
  at(x: number, z: number): number {
    const cx = (x - this.originX) / this.step
    const cz = (z - this.originZ) / this.step
    const clampedX = clamp(cx, 0, this.cols - 1)
    const clampedZ = clamp(cz, 0, this.rows - 1)
    const outside = Math.hypot(cx - clampedX, cz - clampedZ) * this.step
    return this.#sample(clampedX, clampedZ) + outside
  }

  #sample(cx: number, cz: number): number {
    const c0 = Math.floor(cx)
    const r0 = Math.floor(cz)
    const c1 = Math.min(this.cols - 1, c0 + 1)
    const r1 = Math.min(this.rows - 1, r0 + 1)
    const fx = cx - c0
    const fz = cz - r0
    const a = this.#metres[r0 * this.cols + c0]!
    const b = this.#metres[r0 * this.cols + c1]!
    const c = this.#metres[r1 * this.cols + c0]!
    const d = this.#metres[r1 * this.cols + c1]!
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** Exact squared euclidean distance transform, one dimension at a time (Felzenszwalb). */
function transform(squared: Float64Array, cols: number, rows: number): void {
  const line = new Float64Array(Math.max(cols, rows))
  const out = new Float64Array(Math.max(cols, rows))
  const hull = new Int32Array(Math.max(cols, rows))
  const edge = new Float64Array(Math.max(cols, rows) + 1)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) line[c] = squared[r * cols + c]!
    envelope(line, out, hull, edge, cols)
    for (let c = 0; c < cols; c++) squared[r * cols + c] = out[c]!
  }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) line[r] = squared[r * cols + c]!
    envelope(line, out, hull, edge, rows)
    for (let r = 0; r < rows; r++) squared[r * cols + c] = out[r]!
  }
}

/** Lower envelope of the parabolas rooted at each sample: the 1D distance transform. */
function envelope(f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array, n: number): void {
  let k = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!)
    while (s <= z[k]!) {
      k--
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!)
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++
    const offset = q - v[k]!
    d[q] = offset * offset + f[v[k]!]!
  }
}
