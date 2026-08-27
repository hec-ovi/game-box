import { Field } from './field.mjs'
import { SURFACES } from './surfaces.mjs'

/**
 * The maps a colour tile does not carry, worked out from the one it does.
 *
 * A photographed surface holds its own relief twice over: light collects on
 * what stands proud and dirt collects in what is hollow. Subtract the long
 * wavelengths, which are stain rather than shape, and what is left is a height
 * field good enough to differentiate into a normal, to read a cavity out of,
 * and to push a roughness around with.
 *
 * Nothing here is a photograph of a normal map, and it does not pretend to be:
 * it is a height field with a stated cut-off and a stated slope, so what it
 * claims can be measured off the file it writes.
 */
export class Relief {
  /**
   * @param {{ size: number, luminance: Field, mean: number }} tile linear luminance of the colour tile
   * @param {{ across: number, up: number }} metres of real surface one repeat of the tile covers
   * @param {string} surface a name in SURFACES
   * @param {number} size pixels a side of the maps to write
   */
  constructor(tile, metres, surface, size) {
    const family = SURFACES[surface]
    if (!family) throw new Error(`relief: no surface called "${surface}"`)
    this.surface = surface
    this.family = family
    this.metres = metres
    this.size = size

    // long wavelengths are stain, not shape: a soot wash a metre across is
    // painted on, a board mark ten centimetres across is pressed in
    const perPixelAcross = metres.across / tile.size
    const perPixelUp = metres.up / tile.size
    this.height = tile.luminance
      .minus(tile.luminance.blur(family.cut / perPixelAcross, family.cut / perPixelUp))
      .map((value) => value / tile.mean)
      .resized(size)
    this.darkness = tile.luminance.map((value) => (tile.mean - value) / tile.mean).resized(size)

    this.#slopes()
    this.#roughness()
    this.#occlusion()
  }

  /** How many metres of height the tile's own contrast was taken to mean. */
  get gain() {
    return this.#gain
  }

  /** Tilt of the derived normal off the surface, in degrees, at the given share. */
  tilt(share) {
    return (Math.atan(this.#slope.quantile(share)) * 180) / Math.PI
  }

  /** Peak to peak height the map stands for, in millimetres, over the middle 98% of the field. */
  get relief() {
    return (this.height.quantile(0.99) - this.height.quantile(0.01)) * this.#gain * 1000
  }

  /** Tangent space normal, three bytes a texel, in the convention the kit's own maps are authored in. */
  normalBytes() {
    const out = Buffer.alloc(this.size * this.size * 3)
    for (let at = 0, to = 0; at < this.#nx.length; at++, to += 3) {
      const length = Math.hypot(this.#nx[at], this.#ny[at], 1)
      out[to] = byte(0.5 + (0.5 * -this.#nx[at]) / length)
      out[to + 1] = byte(0.5 + (0.5 * this.#ny[at]) / length)
      out[to + 2] = byte(0.5 + 0.5 / length)
    }
    return out
  }

  /** Occlusion, roughness and metalness in one image, which is how glTF carries them. */
  ormBytes() {
    const out = Buffer.alloc(this.size * this.size * 3)
    const metal = byte(this.family.metal ?? 0)
    for (let at = 0, to = 0; at < this.#rough.length; at++, to += 3) {
      out[to] = byte(this.#ao[at])
      out[to + 1] = byte(this.#rough[at])
      out[to + 2] = metal
    }
    return out
  }

  /**
   * The two normal axes and the roughness in one opaque RGB texel, for a
   * consumer stacking many surfaces into one array texture: a second image
   * would be a second fetch and twice the memory. The third normal axis is
   * always positive on a height field, so it comes back as the square root of
   * what is left.
   *
   * Occlusion is deliberately not the fourth channel. A strip is decoded
   * through a 2D canvas, whose backing store is premultiplied, so an alpha of
   * 0.4 costs the other three channels a level on the way back out: 0.45
   * degrees of noise on a normal whose median tilt is a fifth of a degree.
   * Where a consumer can carry occlusion without that (a glTF material, where
   * it is a channel of its own image) `ormBytes` has it.
   */
  packedBytes() {
    const out = Buffer.alloc(this.size * this.size * 3)
    for (let at = 0, to = 0; at < this.#nx.length; at++, to += 3) {
      const length = Math.hypot(this.#nx[at], this.#ny[at], 1)
      out[to] = byte(0.5 + (0.5 * -this.#nx[at]) / length)
      out[to + 1] = byte(0.5 + (0.5 * this.#ny[at]) / length)
      out[to + 2] = byte(this.#rough[at])
    }
    return out
  }

  /** What the maps actually came out at, for the report and for a test to hold. */
  report() {
    const rough = new Field(this.size, Float64Array.from(this.#rough))
    const ao = new Field(this.size, Float64Array.from(this.#ao))
    return {
      surface: this.surface,
      size: this.size,
      metres: this.metres,
      millimetresPerTexel: {
        across: (this.metres.across / this.size) * 1000,
        up: (this.metres.up / this.size) * 1000,
      },
      tilt: { median: this.tilt(0.5), p90: this.tilt(0.9), p99: this.tilt(0.99) },
      relief: this.relief,
      roughness: { min: rough.quantile(0), mean: rough.mean, max: rough.quantile(1) },
      occlusion: { min: ao.quantile(0), mean: ao.mean },
      metalness: this.family.metal ?? 0,
    }
  }

  #gain = 0
  #slope = Field.zeros(1)
  #nx = new Float64Array(0)
  #ny = new Float64Array(0)
  #rough = new Float64Array(0)
  #ao = new Float64Array(0)

  /**
   * The gradient of the height field, scaled so the map stands for the depth of
   * relief the material really has. The height field is contrast, not
   * millimetres, so the gain is millimetres per unit of contrast: take the
   * middle 98% of the field, which is the swing without the specks, and stretch
   * it onto the family's own depth. Then the slope follows, and the tilt it
   * comes out at is a measurement rather than a setting.
   */
  #slopes() {
    const n = this.size
    const swing = this.height.quantile(0.99) - this.height.quantile(0.01)
    this.#gain = swing > 0 ? this.family.relief / 1000 / swing : 0
    const acrossMetres = this.metres.across / n
    const upMetres = this.metres.up / n
    const gx = new Float64Array(n * n)
    const gy = new Float64Array(n * n)

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        // Sobel: three rows and three columns, so one noisy texel cannot tilt a facet
        const across =
          this.height.at(x + 1, y - 1) + 2 * this.height.at(x + 1, y) + this.height.at(x + 1, y + 1) -
          this.height.at(x - 1, y - 1) - 2 * this.height.at(x - 1, y) - this.height.at(x - 1, y + 1)
        const down =
          this.height.at(x - 1, y + 1) + 2 * this.height.at(x, y + 1) + this.height.at(x + 1, y + 1) -
          this.height.at(x - 1, y - 1) - 2 * this.height.at(x, y - 1) - this.height.at(x + 1, y - 1)
        gx[y * n + x] = across / (8 * acrossMetres)
        gy[y * n + x] = down / (8 * upMetres)
      }
    }

    this.#nx = Float64Array.from(gx, (value) => value * this.#gain)
    this.#ny = Float64Array.from(gy, (value) => value * this.#gain)
    this.#slope = new Field(n, Float64Array.from(this.#nx, (value, at) => Math.hypot(value, this.#ny[at])))
  }

  /**
   * The material's own roughness, moved about by what the picture shows: grime,
   * which is how far below the tile's average a texel is, and cavity, which is
   * how far below its neighbours it sits. Both are taken in units of their own
   * spread, so a flat photograph and a contrasty one use the same share of the
   * family's range.
   */
  #roughness() {
    const { base, min, max } = this.family.rough
    const grime = normalised(this.darkness.data)
    const cavity = normalised(Float64Array.from(this.height.data, (value) => -value))
    const share = this.family.grime
    // two and a half deviations reaches the end of the range, so the tail is
    // clamped and the body of the distribution uses the range it was given
    const up = (max - base) / 2.5
    const down = (base - min) / 2.5

    this.#rough = new Float64Array(grime.length)
    for (let at = 0; at < grime.length; at++) {
      const signal = share * grime[at] + (1 - share) * cavity[at]
      this.#rough[at] = clamp(base + signal * (signal > 0 ? up : down), min, max)
    }
  }

  /**
   * How much of the sky a texel can see: one, except where the height field
   * says it sits in a hollow, and `ao` deep at the bottom of the deepest one.
   * Two deviations is the floor, so a joint reads and a noisy texel does not.
   */
  #occlusion() {
    const deviation = this.height.deviation || 1
    this.#ao = Float64Array.from(this.height.data, (value) =>
      1 - this.family.ao * clamp(-value / (2 * deviation), 0, 1),
    )
  }
}

/** A signal in units of its own standard deviation, centred on its own mean. */
function normalised(values) {
  const field = new Field(Math.round(Math.sqrt(values.length)), values)
  const mean = field.mean
  const deviation = field.deviation || 1
  return Float64Array.from(values, (value) => (value - mean) / deviation)
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
const byte = (value) => Math.max(0, Math.min(255, Math.round(value * 255)))
