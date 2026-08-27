import { Rng } from '@gb/kit'
import { decode, encode, type Rgb } from './paint.ts'

/**
 * The flat panels and the four shared faces, drawn from arithmetic.
 *
 * A theme pack names its images; the ones it does not carry are drawn here. A
 * closed curtain, a lowered blind, a bricked up opening, a floor seen from
 * straight above: each is a surface with one light on it, which is a few
 * hundred numbers rather than a photograph. Every one is authored the way the
 * pack's prompts describe the same file, so a drawn panel and a generated one
 * land in the same city without a seam, and dropping the image in replaces the
 * drawing.
 *
 * They are read unlit through glass and multiplied by the night, so what is
 * drawn here is the light in the picture: a dark shutter stays dark when the
 * window it is behind is called lit, which is the honest answer.
 */

/** Written the way it is read, as sRGB, and drawn in linear light. */
const INK = {
  slate: [0.1, 0.115, 0.135],
  dark: [0.035, 0.04, 0.05],
  cloth: [0.2, 0.2, 0.23],
  steel: [0.16, 0.17, 0.19],
  concrete: [0.23, 0.23, 0.235],
  mortar: [0.13, 0.13, 0.14],
  paper: [0.6, 0.56, 0.48],
  plaster: [0.26, 0.26, 0.27],
  tungsten: [1.0, 0.76, 0.45],
  cold: [0.78, 0.85, 0.95],
} as const satisfies Record<string, Rgb>

/** One surface being drawn: linear light, painted in shares of the frame, y from the top. */
class Surface {
  readonly #size: number
  readonly #light: Float32Array
  readonly #rng: Rng

  constructor(size: number, seed: string) {
    this.#size = size
    this.#light = new Float32Array(size * size * 3)
    this.#rng = new Rng(`panel/${seed}`)
  }

  /** A ramp between two colours down the whole frame. */
  fill(top: Rgb, bottom: Rgb = top): this {
    return this.rect(0, 0, 1, 1, top, bottom)
  }

  /** A rectangle, its colour ramping top to bottom. */
  rect(x0: number, y0: number, x1: number, y1: number, colour: Rgb, to: Rgb = colour): this {
    const [left, right] = [Math.round(x0 * this.#size), Math.round(x1 * this.#size)]
    const [top, bottom] = [Math.round(y0 * this.#size), Math.round(y1 * this.#size)]
    const span = Math.max(1, bottom - top - 1)
    const from = linear(colour)
    const onto = linear(to)
    for (let y = Math.max(0, top); y < Math.min(this.#size, bottom); y++) {
      const down = (y - top) / span
      for (let x = Math.max(0, left); x < Math.min(this.#size, right); x++) {
        const at = (y * this.#size + x) * 3
        for (let c = 0; c < 3; c++) this.#light[at + c] = from[c]! + (onto[c]! - from[c]!) * down
      }
    }
    return this
  }

  /** Scales every column by a function of where it is across the frame: folds, ribs, a seam. */
  columns(shade: (x: number) => number): this {
    for (let x = 0; x < this.#size; x++) {
      const by = shade(x / (this.#size - 1))
      for (let y = 0; y < this.#size; y++) {
        const at = (y * this.#size + x) * 3
        for (let c = 0; c < 3; c++) this.#light[at + c] = this.#light[at + c]! * by
      }
    }
    return this
  }

  /** The same down the frame: slats, tile courses, a wash from a strip light. */
  rows(shade: (y: number) => number): this {
    for (let y = 0; y < this.#size; y++) {
      const by = shade(y / (this.#size - 1))
      for (let x = 0; x < this.#size; x++) {
        const at = (y * this.#size + x) * 3
        for (let c = 0; c < 3; c++) this.#light[at + c] = this.#light[at + c]! * by
      }
    }
    return this
  }

  /** One light, added: an ellipse of it falling off to nothing at its edge. */
  glow(cx: number, cy: number, rx: number, ry: number, colour: Rgb, strength: number): this {
    const ink = linear(colour)
    for (let y = 0; y < this.#size; y++) {
      const dy = (y / (this.#size - 1) - cy) / ry
      for (let x = 0; x < this.#size; x++) {
        const dx = (x / (this.#size - 1) - cx) / rx
        const reach = dx * dx + dy * dy
        if (reach >= 1) continue
        const fall = (1 - reach) ** 2 * strength
        const at = (y * this.#size + x) * 3
        for (let c = 0; c < 3; c++) this.#light[at + c] = this.#light[at + c]! + ink[c]! * fall
      }
    }
    return this
  }

  /** Speckle, so a flat surface is not a flat colour under a light. */
  grain(amount: number): this {
    for (let at = 0; at < this.#light.length; at += 3) {
      const by = 1 + this.#rng.range(-amount, amount)
      for (let c = 0; c < 3; c++) this.#light[at + c] = this.#light[at + c]! * by
    }
    return this
  }

  /** The picture as a strip layer stores it: sRGB, opaque. */
  bytes(): Buffer {
    const out = Buffer.alloc(this.#size * this.#size * 4, 255)
    for (let at = 0; at < this.#size * this.#size; at++) {
      for (let c = 0; c < 3; c++) out[at * 4 + c] = encode(this.#light[at * 3 + c]!)
    }
    return out
  }
}

/** How a panel or a face is drawn when the pack carries no image for it. */
type Recipe = (surface: Surface) => void

/**
 * The recipes, by the filename the pack's prompts give each image, so a
 * generated one lands in the same slot as the drawing it replaces.
 *
 * Every one of them is one surface, one light, and nothing else. That is what a
 * window with no room behind it is, and it is why these are the cheap kind.
 */
const RECIPES: Record<string, Recipe> = {
  // heavy curtains fully closed, two panels meeting at the centre, a thin warm
  // line escaping the gap and a wash along the floor
  'curtain-drawn': (it) => {
    it.fill(INK.cloth, INK.dark)
      .columns((x) => 0.5 + 0.5 * Math.abs(Math.cos(x * Math.PI * 13)) ** 0.6)
      .rows((y) => 1 - 0.3 * y)
      .rect(0.492, 0, 0.508, 1, scaled(INK.tungsten, 0.5), scaled(INK.tungsten, 0.75))
      .glow(0.5, 0.6, 0.16, 0.75, INK.tungsten, 0.09)
      .rect(0, 0.965, 1, 1, scaled(INK.tungsten, 0.35), scaled(INK.tungsten, 0.6))
      .glow(0.5, 1.0, 0.85, 0.22, INK.tungsten, 0.07)
      .grain(0.04)
  },
  // pulled to both sides: two bands of fabric at the edges, dim wall between,
  // one lamp low on the right
  'curtain-open': (it) => {
    it.fill(INK.slate, INK.dark)
      .rect(0, 0, 0.19, 1, INK.cloth, INK.dark)
      .rect(0.81, 0, 1, 1, INK.cloth, INK.dark)
      .columns((x) => (x > 0.2 && x < 0.8 ? 1 : 0.55 + 0.45 * Math.abs(Math.cos(x * Math.PI * 22)) ** 0.7))
      .glow(0.74, 0.82, 0.55, 0.55, INK.tungsten, 0.11)
      .glow(0.74, 0.82, 0.14, 0.09, INK.tungsten, 0.3)
      .grain(0.035)
  },
  // forty slats almost closed, one light behind drawing a line along the
  // underside of each
  'blind-slats': (it) => {
    it.fill(INK.steel, INK.steel)
      .rows((y) => slat(y, 34, 9, 0.16))
      .glow(0.5, 0.68, 1.0, 0.7, INK.tungsten, 0.05)
      .grain(0.03)
  },
  // the same blind tilted half open: the gaps read dark and the light gets
  // through unevenly, brighter at the bottom
  'blind-angled': (it) => {
    it.fill(INK.steel, INK.steel)
      .rows((y) => slat(y, 22, 6, 0.42) * (0.55 + 0.75 * y))
      .glow(0.44, 0.95, 0.85, 0.5, INK.tungsten, 0.08)
      .grain(0.03)
  },
  // obscure glass: one blurred light behind it, everything else even and cold
  'frosted-glass': (it) => {
    it.fill(INK.slate, INK.slate).glow(0.42, 0.46, 0.75, 0.75, INK.cold, 0.06).glow(0.42, 0.46, 0.34, 0.34, INK.tungsten, 0.09).grain(0.05)
  },
  // dull painted metal, one strip light along the top washing down
  'blank-panel': (it) => {
    it.fill(INK.slate, INK.dark)
      .rows((y) => (y < 0.06 ? 1 : 1 - 0.7 * y))
      .rect(0, 0.012, 1, 0.058, INK.cold, INK.cold)
      .glow(0.5, 0.06, 1.0, 0.45, INK.cold, 0.09)
      .grain(0.03)
  },
  // a bricked up opening: blockwork on a regular grid, no light of its own
  'concrete-infill': (it) => {
    it.fill(INK.mortar)
    for (let course = 0; course < 8; course++) {
      const y = course / 8
      const offset = course % 2 === 0 ? 0 : 0.5
      for (let block = -1; block < 4; block++) {
        const x = (block + offset) / 4
        it.rect(x + 0.008, y + 0.014, x + 0.25 - 0.008, y + 0.125 - 0.014, scaled(INK.concrete, 1.35), scaled(INK.concrete, 0.8))
      }
    }
    it.rows((y) => 0.6 + 0.4 * (1 - y)).grain(0.06)
  },
  // sheets of paper taped over the inside of the glass, one light behind them
  'paper-covered': (it) => {
    it.fill(INK.dark)
    for (const [x0, y0, x1, y1, shade] of [
      [0.03, 0.04, 0.55, 0.52, 0.9],
      [0.46, 0.02, 0.98, 0.49, 1.05],
      [0.06, 0.47, 0.58, 0.97, 0.82],
      [0.49, 0.51, 0.97, 0.98, 0.96],
    ] as const) {
      it.rect(x0, y0, x1, y1, scaled(INK.paper, shade), scaled(INK.paper, shade * 0.7))
    }
    it.glow(0.5, 0.5, 0.95, 0.95, INK.tungsten, 0.05).rows((y) => 0.85 + 0.15 * (1 - y)).grain(0.045)
  },
  // a corrugated roller shutter fully down, scuffed near the bottom
  'shutter-steel': (it) => {
    it.fill(scaled(INK.steel, 1.6), INK.steel)
      .columns((x) => 0.35 + 0.9 * Math.abs(Math.cos(x * Math.PI * 26)) ** 0.5)
      .rows((y) => 1 - 0.45 * y)
      .grain(0.09)
  },
  // an unlit room's near wall: bare plaster, one cold spill from the street
  'dark-empty': (it) => {
    it.fill(INK.slate, INK.dark).rows((y) => 1 - 0.55 * y).glow(0.5, 0.0, 1.0, 0.4, INK.cold, 0.05).grain(0.04)
  },

  // worn vinyl tiles seen from straight above, no objects on them at all
  floor: (it) => {
    it.fill(INK.mortar)
    for (let down = 0; down < 4; down++) {
      for (let across = 0; across < 4; across++) {
        const shade = 1.5 + ((across * 3 + down * 5) % 4) * 0.28
        it.rect(across / 4 + 0.007, down / 4 + 0.007, (across + 1) / 4 - 0.007, (down + 1) / 4 - 0.007, scaled(INK.slate, shade), scaled(INK.slate, shade * 0.88))
      }
    }
    it.glow(0.5, 0.34, 0.7, 0.6, INK.tungsten, 0.035).rows((y) => 1 - 0.25 * y).grain(0.06)
  },
  // suspended ceiling tiles seen from straight below, one flush light panel
  ceiling: (it) => {
    it.fill(INK.dark)
    for (let down = 0; down < 3; down++) {
      for (let across = 0; across < 3; across++) {
        it.rect(across / 3 + 0.007, down / 3 + 0.007, (across + 1) / 3 - 0.007, (down + 1) / 3 - 0.007, scaled(INK.plaster, 0.85), scaled(INK.plaster, 0.7))
      }
    }
    it.rect(0.38, 0.1, 0.72, 0.24, INK.cold, INK.cold).glow(0.55, 0.17, 0.8, 0.65, INK.cold, 0.06).grain(0.03)
  },
  // painted plaster with a skirting along the bottom and one faint seam
  'wall-side': (it) => {
    it.fill(scaled(INK.plaster, 1.15), scaled(INK.plaster, 0.5))
      .columns((x) => (Math.abs(x - 0.63) < 0.005 ? 0.65 : 1))
      .rect(0, 0.9, 1, 1, scaled(INK.plaster, 0.6), scaled(INK.plaster, 0.35))
      .rect(0, 0.9, 1, 0.915, scaled(INK.plaster, 1.2), scaled(INK.plaster, 1.2))
      .grain(0.04)
  },
  // exposed concrete with one conduit running down it
  'wall-side-alt': (it) => {
    it.fill(scaled(INK.concrete, 1.1), scaled(INK.concrete, 0.5))
      .rect(0.3, 0, 0.338, 1, scaled(INK.steel, 2.2), scaled(INK.steel, 1.1))
      .columns((x) => (Math.abs(x - 0.299) < 0.006 ? 0.55 : 1))
      .grain(0.06)
  },
}

/**
 * The picture for a name the pack has no file for, drawn.
 *
 * A name with no recipe of its own gets a plain surface with one light on it,
 * placed and coloured off the name itself, so two unnamed panels in one street
 * are not the same rectangle.
 */
export function drawPanel(name: string, size: number): Buffer {
  const surface = new Surface(size, name)
  const recipe = RECIPES[name]
  if (recipe) recipe(surface)
  else {
    const rng = new Rng(`panel/plain/${name}`)
    surface
      .fill(INK.slate, INK.dark)
      .rows((y) => 1 - 0.6 * y)
      .glow(rng.range(0.25, 0.75), rng.range(0.2, 0.8), 0.4, 0.4, rng.chance(0.5) ? INK.tungsten : INK.cold, 0.3)
      .grain(0.04)
  }
  return surface.bytes()
}

/** One slat course: the light catches the underside of each slat, and the gap between them is dark. */
function slat(y: number, count: number, lit: number, gap: number): number {
  const at = (y * count) % 1
  if (at > 1 - gap) return 0.3
  return 0.5 + lit * (at / (1 - gap)) ** 3
}

function scaled(colour: Rgb, by: number): Rgb {
  return [colour[0] * by, colour[1] * by, colour[2] * by]
}

/** sRGB as it is written above, in the linear light the drawing happens in. */
function linear(colour: Rgb): Rgb {
  return colour.map((value) => decode(Math.round(value * 255))) as unknown as Rgb
}
