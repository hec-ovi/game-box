import { Rng } from '@gb/kit'
import sharp from 'sharp'
import { SCREEN_SIZE } from '../src/screens.ts'
import { decode, encode, Picture, type Rgb, type Tile } from './paint.ts'
import { stacked, stemOf, type Strip, type ThemePack } from './theme.ts'

/**
 * What the screens on the walls show, and the plate they are.
 *
 * Which ones a city carries is the theme pack's `ads` list. Most of them are
 * committed pictures in the pack's own `ads/` folder, ours, from our own
 * prompts, so they travel inside a world file with no third party licence near
 * it. One a pack names but does not carry is drawn here instead, because a
 * poster is a poster because of its structure rather than its subject: a
 * saturated ground, one bright mass where the eye lands, and a hard graphic
 * against it. At this size, behind a lamp grid, in the corner of a street, that
 * is what an advertisement is.
 *
 * Every screen goes through the same exposure whichever way it arrived, so a
 * row of ads where one is twice as bright as the next cannot happen.
 *
 * Nothing on them spells anything. Text out of an image model garbles, and the
 * words in this city are `@gb/kitbash`'s business: it draws every letter over
 * every door from a stroke font. A screen that tried to compete with the sign
 * under it would be two typefaces on one building.
 */

/** Colours are written the way they are read, as sRGB, and drawn in linear light. */
type Colour = readonly [number, number, number]

const INK = {
  black: [0.015, 0.015, 0.02],
  amber: [0.85, 0.5, 0.1],
  cyan: [0.28, 0.85, 0.98],
  white: [1.0, 0.99, 0.96],
  ice: [0.8, 0.95, 1.0],
} as const satisfies Record<string, Colour>

/** The plate a screen is: dark, brushed, and no lighter than the wall it hangs on. Only its edges are ever seen. */
const PLATE: Rgb = [13, 14, 16]

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
/**
 * The compositions, by the name a pack declares them under. One of these is
 * used when the pack carries no image of that name; a name with no composition
 * either gets the plain one below.
 *
 * The grammar is a ground, the mass the eye lands on, and one hard edge against
 * it. It is what a poster is when nobody has photographed one.
 */
const POSTERS: Record<string, (poster: Poster) => void> = {
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

/** Every screen a pack declares, read or drawn, stacked into one strip. */
export async function buildScreens(pack: ThemePack): Promise<Strip> {
  const tiles: Buffer[] = []
  for (const file of pack.doc.ads) {
    const image = await pack.image('ads', file)
    tiles.push(image ? await photograph(image) : drawn(stemOf(file)))
  }
  return { strip: await stacked(tiles, SCREEN_SIZE), layers: tiles.length }
}

/**
 * A screen a pack names but does not carry.
 *
 * A name with a composition of its own gets it. Anything else gets the plain
 * one: a ground, one mass and one band, placed and coloured off the name, so
 * two undrawn screens on one street are not the same rectangle.
 */
function drawn(name: string): Buffer {
  const poster = new Poster(SCREEN_SIZE, name)
  const compose = POSTERS[name]
  if (compose) compose(poster)
  else {
    const rng = new Rng(`screen/plain/${name}`)
    const inks = [INK.amber, INK.cyan, INK.ice, INK.white] as const
    poster.ground(rng.pick(inks), INK.black)
    poster.mass(rng.range(0.35, 0.65), rng.range(0.35, 0.6), rng.range(0.14, 0.26), rng.range(0.16, 0.3), INK.white, rng.range(1.6, 3.2))
    poster.band(0, rng.range(0.78, 0.9), 1, 1, INK.black)
  }
  return poster.pixels()
}

/**
 * A committed picture, taken to the exposure every screen in the city shares.
 *
 * It gets the normalisation the drawn posters get and nothing else: no key
 * light, because a photograph already has one, no grain, because it has its
 * own, and none of the contrast push, which exists to stop a flat drawn ground
 * arriving as one rectangle of light and would only crush a picture that has
 * depth in it already.
 */
async function photograph(image: Buffer): Promise<Buffer> {
  const pixels = await sharp(image).resize(SCREEN_SIZE, SCREEN_SIZE, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer()
  const light = new Float32Array(SCREEN_SIZE * SCREEN_SIZE * 3)
  for (let at = 0; at < light.length; at++) light[at] = decode(pixels[at]!)
  return exposed(light, SCREEN_SIZE, 1)
}

/**
 * The exposure every screen shares: normalised to what its brightest half a
 * percent reaches, so one advertisement is never twice as bright as the next.
 */
function exposed(light: Float32Array, size: number, contrast: number, grain?: Rng): Buffer {
  const sorted = Float32Array.from({ length: size * size }, (_, i) => Math.max(light[i * 3]!, light[i * 3 + 1]!, light[i * 3 + 2]!)).sort()
  const peak = Math.max(1e-3, sorted[Math.floor(sorted.length * 0.995)]!)

  const out = Buffer.alloc(size * size * 4, 255)
  for (let at = 0; at < size * size; at++) {
    const speckle = grain ? 1 + grain.range(-0.02, 0.02) : 1
    for (let c = 0; c < 3; c++) out[at * 4 + c] = encode(Math.max(0, light[at * 3 + c]! / peak) ** contrast * speckle)
  }
  return out
}

/** The plate a screen is: what its edges wear, since its face is all picture. */
export async function plateTile(size: number): Promise<Tile> {
  return await new Picture(size, 'display').paint({ x0: 0, y0: 0, x1: 1, y1: 1 }, { colour: PLATE, grain: 1.5 }).tile()
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
    return exposed(this.#light, this.#size, CONTRAST, this.#rng)
  }
}

/** sRGB as it is written above, in the linear light the drawing happens in. */
function linear(colour: Colour): Colour {
  return colour.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)) as unknown as Colour
}
