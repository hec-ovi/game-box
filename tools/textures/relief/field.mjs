/**
 * A one-channel float image that wraps.
 *
 * Every step of a derived map has to address off the edge: a blur at the border
 * reads the far side, a gradient at column 0 reads the last column. Clamping
 * instead would put a ridge round all four edges of the tile and a hard line
 * across the wall wherever the tile repeats, which is the one thing the tile
 * was cut to avoid.
 */
export class Field {
  /** @param {number} size @param {Float64Array} data */
  constructor(size, data) {
    this.size = size
    this.data = data
  }

  static zeros(size) {
    return new Field(size, new Float64Array(size * size))
  }

  at(x, y) {
    const n = this.size
    return this.data[(((y % n) + n) % n) * n + (((x % n) + n) % n)]
  }

  get mean() {
    let sum = 0
    for (const value of this.data) sum += value
    return sum / this.data.length
  }

  /** Standard deviation about the mean: the scale a signal is normalised by. */
  get deviation() {
    const mean = this.mean
    let sum = 0
    for (const value of this.data) sum += (value - mean) ** 2
    return Math.sqrt(sum / this.data.length)
  }

  /** The value below which `share` of the field sits. */
  quantile(share) {
    const sorted = Float64Array.from(this.data).sort()
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(share * (sorted.length - 1))))]
  }

  map(f) {
    const out = new Float64Array(this.data.length)
    for (let at = 0; at < out.length; at++) out[at] = f(this.data[at], at)
    return new Field(this.size, out)
  }

  /** This field minus another, pixel for pixel. */
  minus(other) {
    return this.map((value, at) => value - other.data[at])
  }

  /**
   * Separable box blur, three passes, which is close enough to a gaussian and
   * costs the same whatever the radius. Both passes wrap, and each axis takes
   * its own radius: a tile laid on a wall wider than it is tall is not the same
   * number of pixels per metre in both directions.
   */
  blur(radiusX, radiusY = radiusX) {
    const n = this.size
    let src = Float64Array.from(this.data)
    let dst = new Float64Array(src.length)
    const acrossReach = Math.max(1, Math.round(radiusX))
    const downReach = Math.max(1, Math.round(radiusY))

    for (let pass = 0; pass < 3; pass++) {
      const across = acrossReach * 2 + 1
      for (let y = 0; y < n; y++) {
        let sum = 0
        for (let x = -acrossReach; x <= acrossReach; x++) sum += src[y * n + wrap(x, n)]
        for (let x = 0; x < n; x++) {
          dst[y * n + x] = sum / across
          sum += src[y * n + wrap(x + acrossReach + 1, n)] - src[y * n + wrap(x - acrossReach, n)]
        }
      }
      ;[src, dst] = [dst, src]
      const down = downReach * 2 + 1
      for (let x = 0; x < n; x++) {
        let sum = 0
        for (let y = -downReach; y <= downReach; y++) sum += src[wrap(y, n) * n + x]
        for (let y = 0; y < n; y++) {
          dst[y * n + x] = sum / down
          sum += src[wrap(y + downReach + 1, n) * n + x] - src[wrap(y - downReach, n) * n + x]
        }
      }
      ;[src, dst] = [dst, src]
    }
    return new Field(n, src)
  }

  /**
   * The field at another size, area-averaged going down and bilinear going up,
   * both wrapping. A derived map is computed at the size it will be stored at,
   * because a slope is metres of height over metres of surface and the second
   * of those is the texel.
   */
  resized(size) {
    if (size === this.size) return this
    const out = Field.zeros(size)
    const step = this.size / size
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        out.data[y * size + x] = step >= 1 ? this.#area(x * step, y * step, step) : this.#bilinear(x * step, y * step)
      }
    }
    return out
  }

  /**
   * The average over exactly one output texel's worth of input, weighted by how
   * much of each input texel it covers. Whole samples would make neighbouring
   * output texels share inputs, which leaves them more alike than they should
   * be everywhere except across the wrap, and reads as a line at every repeat.
   */
  #area(x0, y0, step) {
    const right = x0 + step
    const bottom = y0 + step
    let sum = 0
    let weight = 0
    for (let y = Math.floor(y0); y < bottom; y++) {
      const down = Math.min(y + 1, bottom) - Math.max(y, y0)
      for (let x = Math.floor(x0); x < right; x++) {
        const across = Math.min(x + 1, right) - Math.max(x, x0)
        sum += this.at(x, y) * down * across
        weight += down * across
      }
    }
    return sum / weight
  }

  #bilinear(x, y) {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const top = this.at(x0, y0) * (1 - fx) + this.at(x0 + 1, y0) * fx
    const bottom = this.at(x0, y0 + 1) * (1 - fx) + this.at(x0 + 1, y0 + 1) * fx
    return top * (1 - fy) + bottom * fy
  }
}

const wrap = (v, n) => ((v % n) + n) % n
