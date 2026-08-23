import sharp from 'sharp'
import { UvMask } from './uv-mask.mjs'

/** How far a repainted island bleeds outwards, in pixels, so seams stay clean. */
const BLEED = 4

/**
 * One outfit's own copy of a source atlas.
 *
 * The pack paints four outfits onto two textures and puts the male and female
 * cut of a garment on the same islands, so nothing can be recoloured in place
 * without recolouring somebody else. Each outfit gets its own repainted sheet
 * instead. It costs nothing: every finished character is a standalone file and
 * already carried a copy of the original.
 *
 * Whatever no garment in this outfit uses is flooded with the nearest colour
 * that was painted. It costs nothing to encode and it is what keeps the mip
 * chain honest: a sheet left blank between its islands averages that blank
 * into every distant pixel, and a street of people turns grey from ten metres
 * away.
 */
export class OutfitAtlas {
  #pixels
  #lit
  #size
  #used
  #glowing = false

  /** `source` is a path or the bytes of a PNG. */
  static async load(source, size) {
    const pixels = await sharp(source).resize(size, size).removeAlpha().raw().toBuffer()
    return new OutfitAtlas(pixels, size)
  }

  constructor(pixels, size) {
    this.#pixels = pixels
    this.#lit = Buffer.alloc(size * size * 3)
    this.#size = size
    this.#used = new Uint8Array(size * size)
  }

  get size() {
    return this.#size
  }

  /** An empty mask at this atlas's resolution, to fill from a garment's primitives. */
  mask() {
    return new UvMask(this.#size)
  }

  /** Repaints one garment. Returns how many pixels of each fabric changed. */
  paint(mask, repaint) {
    mask.grow(BLEED)
    for (let at = 0; at < this.#used.length; at++) if (mask.at(at)) this.#used[at] = 1
    this.#glowing ||= repaint.glows()
    return repaint.apply(this.#pixels, mask, this.#lit)
  }

  /**
   * The sheet the garment emits from, or nothing if this outfit has no lit
   * accent. Black everywhere but the accent, so it costs almost nothing to
   * ship and nothing to look at where it is not wanted.
   */
  async toGlowPng() {
    if (!this.#glowing) return undefined
    return sharp(this.#lit, { raw: { width: this.#size, height: this.#size, channels: 3 } })
      .png({ compressionLevel: 9 })
      .toBuffer()
  }

  /** PNG bytes, padded out from what was painted. */
  async toPng() {
    this.#flood()
    return sharp(this.#pixels, { raw: { width: this.#size, height: this.#size, channels: 3 } })
      .png({ compressionLevel: 9 })
      .toBuffer()
  }

  /**
   * Spreads the painted colours outwards until the sheet is full: a breadth
   * first walk off the edge of every island, so each blank pixel ends up the
   * colour of the nearest painted one.
   */
  #flood() {
    const size = this.#size
    const queue = new Int32Array(size * size)
    let head = 0
    let tail = 0
    for (let at = 0; at < this.#used.length; at++) if (this.#used[at]) queue[tail++] = at

    while (head < tail) {
      const at = queue[head++]
      const x = at % size
      const y = (at - x) / size
      for (const next of [x > 0 ? at - 1 : -1, x < size - 1 ? at + 1 : -1, y > 0 ? at - size : -1, y < size - 1 ? at + size : -1]) {
        if (next < 0 || this.#used[next]) continue
        this.#used[next] = 1
        this.#pixels[next * 3] = this.#pixels[at * 3]
        this.#pixels[next * 3 + 1] = this.#pixels[at * 3 + 1]
        this.#pixels[next * 3 + 2] = this.#pixels[at * 3 + 2]
        queue[tail++] = next
      }
    }
  }
}
