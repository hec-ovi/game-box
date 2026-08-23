/**
 * Which pixels of a shared atlas one garment actually uses.
 *
 * Four outfits share two atlases, and the male and female cuts of the same
 * garment sit on the same islands. Repainting a garment therefore means
 * repainting its own pixels and leaving the rest alone, so every outfit can be
 * a different colour off the one source texture.
 */
export class UvMask {
  #size
  #bits

  constructor(size) {
    this.#size = size
    this.#bits = new Uint8Array(size * size)
  }

  get size() {
    return this.#size
  }

  at(index) {
    return this.#bits[index] === 1
  }

  /** Fills in every triangle of one primitive, in texture space. */
  add(primitive) {
    const uv = primitive.getAttribute('TEXCOORD_0')
    const indices = primitive.getIndices()
    if (!uv || !indices) return this
    const list = indices.getArray()
    for (let corner = 0; corner < list.length; corner += 3) {
      const xs = []
      const ys = []
      for (let k = 0; k < 3; k++) {
        const point = uv.getElement(list[corner + k], [])
        xs.push(point[0] * this.#size)
        // glTF puts v = 0 at the top row of the image, which is why its
        // textures load unflipped. Read it the other way round and every
        // garment paints the island of whatever is mirrored across the sheet.
        ys.push(point[1] * this.#size)
      }
      this.#triangle(xs, ys)
    }
    return this
  }

  /**
   * Spreads the mask outwards. Texture filtering and the mip chain both reach
   * past an island's edge, so a mask cut exactly to the triangles leaves a rim
   * of the old colour showing along every seam.
   */
  grow(rings) {
    for (let ring = 0; ring < rings; ring++) {
      const before = this.#bits.slice()
      for (let y = 0; y < this.#size; y++) {
        for (let x = 0; x < this.#size; x++) {
          const at = y * this.#size + x
          if (before[at]) continue
          const near =
            (x > 0 && before[at - 1]) ||
            (x < this.#size - 1 && before[at + 1]) ||
            (y > 0 && before[at - this.#size]) ||
            (y < this.#size - 1 && before[at + this.#size])
          if (near) this.#bits[at] = 1
        }
      }
    }
    return this
  }

  #triangle(xs, ys) {
    const left = Math.max(0, Math.floor(Math.min(...xs)))
    const right = Math.min(this.#size - 1, Math.ceil(Math.max(...xs)))
    const top = Math.max(0, Math.floor(Math.min(...ys)))
    const bottom = Math.min(this.#size - 1, Math.ceil(Math.max(...ys)))
    const [ax, bx, cx] = xs
    const [ay, by, cy] = ys
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
    if (!area) return

    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const px = x + 0.5
        const py = y + 0.5
        const u = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / area
        const v = ((px - ax) * (cy - ay) - (cx - ax) * (py - ay)) / area
        // a hair of slack, so a pixel a triangle only grazes is still covered
        if (u < -0.003 || v < -0.003 || u + v > 1.003) continue
        this.#bits[y * this.#size + x] = 1
      }
    }
  }
}
