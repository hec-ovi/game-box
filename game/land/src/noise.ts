/**
 * Deterministic value noise. Same seed, same hills, on any machine: the hash
 * is integer arithmetic, so there is no float drift between platforms.
 */
export class Noise {
  readonly #seed: number

  constructor(seed: number) {
    this.#seed = seed | 0
  }

  /** Smooth noise in [-1, 1] at one frequency. */
  value(x: number, y: number): number {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = smooth(x - ix)
    const fy = smooth(y - iy)

    const a = this.#corner(ix, iy)
    const b = this.#corner(ix + 1, iy)
    const c = this.#corner(ix, iy + 1)
    const d = this.#corner(ix + 1, iy + 1)

    const top = a + (b - a) * fx
    const bottom = c + (d - c) * fx
    return top + (bottom - top) * fy
  }

  /** Layered noise in roughly [-1, 1]: broad shapes with finer ones on top. */
  fbm(x: number, y: number, octaves = 4): number {
    let sum = 0
    let amplitude = 1
    let total = 0
    let frequency = 1
    for (let octave = 0; octave < octaves; octave++) {
      sum += this.value(x * frequency, y * frequency) * amplitude
      total += amplitude
      amplitude *= 0.5
      frequency *= 2.03
    }
    return sum / total
  }

  #corner(ix: number, iy: number): number {
    let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ this.#seed
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
    h ^= h >>> 12
    h = Math.imul(h, 0x297a2d39)
    h ^= h >>> 15
    return ((h >>> 0) / 2147483647.5) - 1
  }
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}
