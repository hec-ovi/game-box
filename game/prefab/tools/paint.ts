import { Rng } from '@gb/kit'
import sharp from 'sharp'
import { GLOW } from '../src/pack.ts'

/**
 * What every picture in the pack is drawn with: sRGB and linear light, a
 * rectangle painter, and the write to PNG.
 *
 * The pack stores colour as sRGB bytes because that is what the GPU decodes on
 * the way in, and glow in the same bytes divided down by what the runtime
 * multiplies back. Both conversions live here so a picture drawn in one file
 * and a picture folded out of a producer material in another land on the same
 * numbers.
 */

export type Rgb = readonly [number, number, number]

/** One finish's two pictures: the surface, and the part of it that burns. */
export interface Tile {
  readonly colour: Buffer
  readonly emissive: Buffer
}

/** A rectangle of a picture, in shares of it. y runs from the top, which is the top of the wall. */
export interface Box {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** What a rectangle is painted with: a vertical ramp of colour, and a vertical ramp of glow. */
export interface Paint {
  readonly colour: Rgb
  /** The colour at the bottom of the rectangle, if it ramps. */
  readonly to?: Rgb
  /** How hard the top of it burns after dark, in the units `GLOW` reads. */
  readonly glow?: number
  readonly glowTo?: number
  /** What colour the glow is. Defaults to the surface's own. */
  readonly tint?: Rgb
  /** Bytes of noise on the surface, so a flat panel is not a flat colour under a lamp. */
  readonly grain?: number
}

/** sRGB byte to linear. The GPU does the same on the way in. */
export function decode(byte: number): number {
  const value = byte / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** Linear back to an sRGB byte, clamped. */
export function encode(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear))
  const value = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
  return Math.round(value * 255)
}

/**
 * The byte a glow map stores for a face that should burn this hard after dark.
 *
 * The runtime multiplies the glow map by `GLOW`, so authoring runs the other
 * way: say what the face is worth and this says what to store. Anything over
 * `GLOW` clips, which is why the loudest thing in the pack sits just under it.
 */
function glowByte(emissive: number): number {
  return encode(emissive / GLOW)
}

/**
 * A picture being drawn: one surface and one glow map, painted rectangle by
 * rectangle in shares of the whole, so the same code draws a door on a leaf of
 * any size.
 */
export class Picture {
  readonly size: number
  readonly #colour: Uint8ClampedArray
  readonly #glow: Uint8ClampedArray
  readonly #rng: Rng

  constructor(size: number, seed: string) {
    this.size = size
    this.#colour = new Uint8ClampedArray(size * size * 4)
    this.#glow = new Uint8ClampedArray(size * size * 4)
    for (let at = 3; at < this.#colour.length; at += 4) {
      this.#colour[at] = 255
      this.#glow[at] = 255
    }
    this.#rng = new Rng(seed)
  }

  paint(box: Box, paint: Paint): this {
    const left = Math.round(box.x0 * this.size)
    const right = Math.round(box.x1 * this.size)
    const top = Math.round(box.y0 * this.size)
    const bottom = Math.round(box.y1 * this.size)
    const span = Math.max(1, bottom - top - 1)
    const tint = paint.tint ?? paint.colour
    const peak = Math.max(tint[0], tint[1], tint[2]) || 1

    for (let y = top; y < bottom; y++) {
      const down = (y - top) / span
      const colour = lerp(paint.colour, paint.to ?? paint.colour, down)
      const glow = (paint.glow ?? 0) + ((paint.glowTo ?? paint.glow ?? 0) - (paint.glow ?? 0)) * down
      // both maps, always. A rectangle laid over another one replaces what
      // burns there as well as what colour it is: a door pull painted over lit
      // glazing is a dark bar across it, not a bar that glows like the glass
      const byte = glowByte(glow)
      for (let x = left; x < right; x++) {
        const grain = paint.grain ? this.#rng.range(-paint.grain, paint.grain) : 0
        this.#set(this.#colour, x, y, [colour[0] + grain, colour[1] + grain, colour[2] + grain])
        this.#set(this.#glow, x, y, [(tint[0] / peak) * byte, (tint[1] / peak) * byte, (tint[2] / peak) * byte])
      }
    }
    return this
  }

  async tile(): Promise<Tile> {
    return { colour: await png(this.#colour, this.size), emissive: await png(this.#glow, this.size) }
  }

  #set(target: Uint8ClampedArray, x: number, y: number, rgb: Rgb): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return
    const at = (y * this.size + x) * 4
    target[at] = rgb[0]
    target[at + 1] = rgb[1]
    target[at + 2] = rgb[2]
  }
}

/** A picture at the pack's own compression, from raw RGBA. */
export async function png(pixels: Uint8ClampedArray | Buffer, width: number, height = width): Promise<Buffer> {
  const bytes = pixels instanceof Buffer ? pixels : Buffer.from(pixels.buffer, 0, width * height * 4)
  return await sharp(bytes, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9, effort: 10 }).toBuffer()
}

function lerp(from: Rgb, to: Rgb, at: number): Rgb {
  return [from[0] + (to[0] - from[0]) * at, from[1] + (to[1] - from[1]) * at, from[2] + (to[2] - from[2]) * at]
}
