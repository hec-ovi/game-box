import { Rng } from '@gb/kit'
import sharp from 'sharp'
import { SCREEN_PICTURES, SCREEN_SIZE } from '../src/screens.ts'
import { encode, Picture, type Rgb, type Tile } from './paint.ts'

/**
 * What the screens on the walls show, and the housing they sit in.
 *
 * The pictures are drawn here rather than generated, so the pack keeps its
 * byte-for-byte promise and there is no third party licence anywhere near a
 * world file. A poster is a poster because of its structure, not its subject: a
 * saturated ground, one bright mass where the eye lands, and a hard graphic
 * against it. At this size, behind a lamp grid, in the corner of a street, that
 * is what an advertisement is.
 *
 * Nothing here spells anything. Text out of an image model garbles, and the
 * words in this city are `@gb/kitbash`'s business: it draws every letter over
 * every door from a stroke font. A screen that tried to compete with the sign
 * under it would be two typefaces on one building.
 */

/** Colours are written the way they are read, as sRGB, and drawn in linear light. */
type Colour = readonly [number, number, number]

const INK = {
  black: [0.015, 0.015, 0.02],
  magenta: [0.62, 0.06, 0.36],
  crimson: [0.42, 0.05, 0.12],
  amber: [0.85, 0.5, 0.1],
  teal: [0.03, 0.28, 0.29],
  cyan: [0.28, 0.85, 0.98],
  violet: [0.24, 0.1, 0.5],
  lime: [0.5, 0.9, 0.3],
  moss: [0.03, 0.1, 0.08],
  skin: [1.0, 0.86, 0.72],
  white: [1.0, 0.99, 0.96],
  ice: [0.8, 0.95, 1.0],
} as const satisfies Record<string, Colour>

/** The housing a screen sits in: dark, brushed, and no lighter than the wall it hangs on. */
const HOUSING: Rgb = [13, 14, 16]

/** How much of a picture the key light takes off the far side of it. */
const FALL = 0.34

/**
 * How hard the grounds are pushed under the highlights.
 *
 * A screen is authored just under clipping and the app tone maps what comes off
 * it, so a poster whose ground sits anywhere near its subject arrives on the
 * street as one flat rectangle of light with nothing in it. Everything but the
 * brightest part of a picture is taken down until the subject is the only thing
 * at the top of the range.
 */
const CONTRAST = 1.7

/**
 * How each screen is composed. A ground, the mass the eye lands on, and one
 * hard edge against it, which is the whole grammar.
 */
const POSTERS: Record<string, (poster: Poster) => void> = {
  portrait: (it) => {
    it.ground(INK.magenta, INK.crimson)
    it.mass(0.44, 0.34, 0.3, 0.36, INK.skin, 2.4)
    it.mass(0.42, 0.26, 0.16, 0.17, INK.white, 3)
    it.mass(0.5, 0.86, 0.44, 0.3, INK.black, 1.6)
    it.band(0.79, 0.05, 1.0, 0.95, INK.cyan)
  },
  bottle: (it) => {
    it.ground(INK.teal, INK.black)
    it.mass(0.5, 0.46, 0.11, 0.34, INK.ice, 3.5)
    it.mass(0.5, 0.3, 0.06, 0.14, INK.white, 4)
    it.band(0.06, 0.8, 0.94, 0.865, INK.amber)
    it.band(0.28, 0.1, 0.3, 0.72, INK.white)
    it.band(0.7, 0.1, 0.72, 0.72, INK.white)
  },
  figure: (it) => {
    it.ground(INK.amber, INK.crimson)
    it.mass(0.6, 0.5, 0.2, 0.46, INK.ice, 2.2)
    it.mass(0.6, 0.5, 0.15, 0.42, INK.black, 2.4)
    it.mass(0.6, 0.22, 0.085, 0.1, INK.skin, 3)
    it.band(0.0, 0.7, 1.0, 1.0, INK.black)
    it.band(0.0, 0.05, 1.0, 0.085, INK.lime)
  },
  bowl: (it) => {
    it.ground(INK.moss, INK.black)
    it.mass(0.5, 0.72, 0.36, 0.19, INK.amber, 2.6)
    it.mass(0.5, 0.68, 0.22, 0.09, INK.white, 3)
    for (const [x, tall] of [[0.36, 0.3], [0.5, 0.22], [0.64, 0.34]] as const) it.mass(x, tall, 0.045, 0.22, INK.ice, 1.4)
    it.band(0.04, 0.06, 0.075, 0.94, INK.magenta)
  },
  bloom: (it) => {
    it.ground(INK.violet, INK.black)
    it.mass(0.5, 0.46, 0.36, 0.36, INK.cyan, 2)
    it.mass(0.5, 0.46, 0.2, 0.2, INK.violet, 2)
    it.mass(0.5, 0.46, 0.07, 0.07, INK.white, 3)
    it.sweep(0.62, 0.075, INK.white)
  },
  skyline: (it) => {
    it.ground(INK.ice, INK.cyan)
    for (const [x, wide, top] of [
      [0.08, 0.1, 0.52],
      [0.22, 0.08, 0.38],
      [0.34, 0.12, 0.6],
      [0.5, 0.09, 0.3],
      [0.63, 0.14, 0.5],
      [0.8, 0.11, 0.42],
    ] as const) {
      it.band(x, top, x + wide, 1.0, INK.black)
    }
    it.mass(0.5, 0.24, 0.3, 0.1, INK.white, 2.4)
    it.band(0.0, 0.9, 1.0, 1.0, INK.amber)
  },
}

/** What the strip carries: the pictures, stacked in the order the runtime picks them by. */
export interface Screens {
  readonly strip: Buffer
  readonly layers: number
}

/** Every screen picture, drawn and stacked into one strip. */
export async function buildScreens(): Promise<Screens> {
  const tiles: Buffer[] = []
  for (const name of SCREEN_PICTURES) {
    const compose = POSTERS[name]
    if (!compose) throw new Error(`no composition for the screen "${name}"`)
    const poster = new Poster(SCREEN_SIZE, name)
    compose(poster)
    tiles.push(poster.pixels())
  }

  const strip = await sharp(Buffer.concat(tiles), { raw: { width: SCREEN_SIZE, height: SCREEN_SIZE * tiles.length, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer()
  return { strip, layers: tiles.length }
}

/** The housing a screen is set into: what the fragments outside the lit face wear. */
export async function housingTile(size: number): Promise<Tile> {
  return await new Picture(size, 'display').paint({ x0: 0, y0: 0, x1: 1, y1: 1 }, { colour: HOUSING, grain: 1.5 }).tile()
}

/**
 * One poster, drawn in linear light and normalised at the end so every screen
 * in the city sits at the same exposure. A row of ads where one is twice as
 * bright as the next reads as a bug, not as variety.
 */
class Poster {
  readonly #size: number
  readonly #light: Float32Array
  readonly #rng: Rng

  constructor(size: number, seed: string) {
    this.#size = size
    this.#light = new Float32Array(size * size * 3)
    this.#rng = new Rng(`screen/${seed}`)
  }

  /** The field behind everything: a vertical ramp between two inks. */
  ground(top: Colour, bottom: Colour): void {
    const from = linear(top)
    const to = linear(bottom)
    for (let y = 0; y < this.#size; y++) {
      const down = y / (this.#size - 1)
      for (let x = 0; x < this.#size; x++) {
        for (let c = 0; c < 3; c++) this.#light[(y * this.#size + x) * 3 + c] = from[c]! + (to[c]! - from[c]!) * down
      }
    }
  }

  /**
   * The mass the eye lands on: a soft super-ellipse laid over what is there.
   * `power` above 2 squares it off, below 2 rounds it away, which is the
   * difference between a bottle, a head and a plume of steam.
   */
  mass(cx: number, cy: number, rx: number, ry: number, colour: Colour, power: number): void {
    const ink = linear(colour)
    for (let y = 0; y < this.#size; y++) {
      const dy = Math.abs((y / (this.#size - 1) - cy) / ry)
      for (let x = 0; x < this.#size; x++) {
        const dx = Math.abs((x / (this.#size - 1) - cx) / rx)
        const reach = dx ** power + dy ** power
        if (reach >= 1) continue
        const cover = (1 - reach) ** 0.65
        const at = (y * this.#size + x) * 3
        for (let c = 0; c < 3; c++) this.#light[at + c] = this.#light[at + c]! + (ink[c]! - this.#light[at + c]!) * cover
      }
    }
  }

  /** A hard edged rectangle: the graphic furniture an advertisement is laid out on. */
  band(x0: number, y0: number, x1: number, y1: number, colour: Colour): void {
    const ink = linear(colour)
    for (let y = Math.round(y0 * this.#size); y < Math.round(y1 * this.#size); y++) {
      for (let x = Math.round(x0 * this.#size); x < Math.round(x1 * this.#size); x++) {
        if (x < 0 || y < 0 || x >= this.#size || y >= this.#size) continue
        const at = (y * this.#size + x) * 3
        for (let c = 0; c < 3; c++) this.#light[at + c] = ink[c]!
      }
    }
  }

  /** A hard diagonal across the whole picture. */
  sweep(at: number, width: number, colour: Colour): void {
    const ink = linear(colour)
    for (let y = 0; y < this.#size; y++) {
      const down = y / (this.#size - 1)
      for (let x = 0; x < this.#size; x++) {
        const along = x / (this.#size - 1)
        if (Math.abs((along + down) / 2 - at) > width / 2) continue
        const to = (y * this.#size + x) * 3
        for (let c = 0; c < 3; c++) this.#light[to + c] = ink[c]!
      }
    }
  }

  /**
   * The picture as the strip stores it: lit across, normalised, grained and
   * back in sRGB.
   *
   * The falloff is what stops a drawn poster reading as printed vector art. An
   * advertisement is a photograph, and a photograph has a key light somewhere,
   * so every screen is laid over a broad ramp in a direction of its own.
   */
  pixels(): Buffer {
    const angle = this.#rng.range(0, Math.PI * 2)
    const [ax, ay] = [Math.cos(angle), Math.sin(angle)]
    for (let y = 0; y < this.#size; y++) {
      for (let x = 0; x < this.#size; x++) {
        const along = ((x / (this.#size - 1) - 0.5) * ax + (y / (this.#size - 1) - 0.5) * ay + 0.71) / 1.42
        const lit = 1 - FALL * along
        const at = (y * this.#size + x) * 3
        for (let c = 0; c < 3; c++) this.#light[at + c] = this.#light[at + c]! * lit
      }
    }

    const sorted = Float32Array.from({ length: this.#size * this.#size }, (_, i) =>
      Math.max(this.#light[i * 3]!, this.#light[i * 3 + 1]!, this.#light[i * 3 + 2]!),
    ).sort()
    const peak = Math.max(1e-3, sorted[Math.floor(sorted.length * 0.995)]!)

    const out = Buffer.alloc(this.#size * this.#size * 4, 255)
    for (let at = 0; at < this.#size * this.#size; at++) {
      const grain = 1 + this.#rng.range(-0.02, 0.02)
      for (let c = 0; c < 3; c++) out[at * 4 + c] = encode(Math.max(0, this.#light[at * 3 + c]! / peak) ** CONTRAST * grain)
    }
    return out
  }
}

/** sRGB as it is written above, in the linear light the drawing happens in. */
function linear(colour: Colour): Colour {
  return colour.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)) as unknown as Colour
}
