import { Rng } from '@gb/kit'
import sharp from 'sharp'
import { FACADE, SHOPFRONT, type WindowKind } from '../src/interior.ts'

/**
 * The picture a wall wears: the surround a window is cut out of, and nothing
 * else.
 *
 * The windows themselves are not here. A mullion is three centimetres across
 * and a wall picture is about twenty pixels to the metre, so a drawn one would
 * be under a texel; the runtime cuts the opening and the bars out of the bay
 * arithmetically instead, and draws the room behind them. What is left for the
 * picture is the two surfaces around that: the pier and the spandrel a family
 * is built out of, and the darker reveal the glass is set back into.
 *
 * Drawn from code rather than generated as an image, for the same reasons
 * `@gb/kitbash` draws its sign letters that way: a panel field is a few lines
 * of arithmetic, it tiles by construction so there is no seam to hide, and it
 * comes out the same on every machine, which the pack's byte-for-byte promise
 * needs.
 */

/** Pixels a side. A picture covers a few bays by a floor or two, so this sets how fine the grain is. */
const SIZE = 256

/** Bays across and floors down each picture holds. What the producer is told, and what the shader reads. */
export const GRID = { facade: FACADE.grid, shopfront: SHOPFRONT.grid } as const

type Rgb = readonly [number, number, number]

/** What one family is built out of: the panel, the joint in it and the reveal a window sits in. */
interface Tone {
  readonly panel: Rgb
  readonly joint: Rgb
  readonly reveal: Rgb
  /** The slab edge between one floor and the next. */
  readonly slab: Rgb
}

/**
 * Four families, four surfaces. `docs/LOOK.md` takes a neon town's walls to
 * near black so the only colour in the street is what is lit, and these are
 * kept far enough apart in hue and value that a facade still reads as having
 * parts rather than being one flat field.
 */
const TONES: Record<string, Tone> = {
  a: { panel: [17, 19, 23], joint: [13, 15, 18], reveal: [9, 10, 13], slab: [22, 24, 28] },
  b: { panel: [23, 19, 18], joint: [17, 14, 13], reveal: [12, 10, 10], slab: [28, 23, 21] },
  c: { panel: [21, 21, 20], joint: [16, 16, 15], reveal: [12, 12, 12], slab: [27, 27, 25] },
  d: { panel: [15, 18, 21], joint: [11, 13, 16], reveal: [8, 10, 12], slab: [20, 23, 27] },
}

export interface Tile {
  readonly colour: Buffer
  readonly emissive: Buffer
}

/** One family's wall above the street: piers, spandrels and the reveals between them. */
export async function facadeTile(family: string): Promise<Tile> {
  return await surface(FACADE, TONES[family] ?? TONES['a']!, `facade/${family}`)
}

/** One family's street level: a heavier surround, because it is seen from a metre away. */
export async function shopfrontTile(family: string): Promise<Tile> {
  const tone = TONES[family] ?? TONES['a']!
  return await surface(SHOPFRONT, { ...tone, panel: lift(tone.panel, 1.25), slab: lift(tone.slab, 1.25) }, `shopfront/${family}`)
}

/**
 * A picture of one family's wall at one tier. Nothing in it glows: after this
 * change every lit thing on a facade is a room the shader draws, so the glow
 * map for these two finishes is black and the neon keeps its own layers.
 */
async function surface(kind: WindowKind, tone: Tone, seed: string): Promise<Tile> {
  const rng = new Rng(seed)
  const pixels = new Uint8ClampedArray(SIZE * SIZE * 4)
  const bay = SIZE / kind.grid.across
  const floor = SIZE / kind.grid.down

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // the panel field, grained so a dark wall is not a flat colour under a lamp
      set(pixels, x, y, shift(tone.panel, rng.range(-2, 2.4)))
    }
  }

  for (let across = 0; across < kind.grid.across; across++) {
    for (let down = 0; down < kind.grid.down; down++) {
      const left = across * bay
      const top = down * floor
      // the slab edge under each floor, and the joint up each bay line
      fill(pixels, left, top, bay, Math.max(2, Math.round(floor * 0.035)), tone.slab, rng)
      fill(pixels, left, top, Math.max(1, Math.round(bay * 0.02)), floor, tone.joint, rng)
      // the reveal: what the glass is set back into, and all a mullion ever shows
      fill(
        pixels,
        left + bay * kind.frame.across,
        top + floor * kind.frame.down,
        bay * (1 - kind.frame.across * 2),
        floor * (1 - kind.frame.down * 2),
        tone.reveal,
        rng,
      )
    }
  }

  const dark = new Uint8ClampedArray(SIZE * SIZE * 4)
  for (let at = 3; at < dark.length; at += 4) dark[at] = 255
  return { colour: await png(pixels), emissive: await png(dark) }
}

function fill(pixels: Uint8ClampedArray, x: number, y: number, wide: number, tall: number, rgb: Rgb, rng: Rng): void {
  for (let dy = 0; dy < Math.max(1, Math.round(tall)); dy++) {
    for (let dx = 0; dx < Math.max(1, Math.round(wide)); dx++) {
      set(pixels, Math.round(x) + dx, Math.round(y) + dy, shift(rgb, rng.range(-1.5, 1.8)))
    }
  }
}

function set(pixels: Uint8ClampedArray, x: number, y: number, rgb: Rgb): void {
  const at = ((((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)) * 4
  pixels[at] = rgb[0]
  pixels[at + 1] = rgb[1]
  pixels[at + 2] = rgb[2]
  pixels[at + 3] = 255
}

function shift(rgb: Rgb, by: number): Rgb {
  return [rgb[0] + by, rgb[1] + by, rgb[2] + by]
}

function lift(rgb: Rgb, by: number): Rgb {
  return [Math.round(rgb[0] * by), Math.round(rgb[1] * by), Math.round(rgb[2] * by)]
}

async function png(pixels: Uint8ClampedArray): Promise<Buffer> {
  return await sharp(Buffer.from(pixels.buffer), { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer()
}
