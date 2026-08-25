/**
 * The thread pattern the garments' roughness is dipped by.
 *
 * A garment painted one flat roughness is a sheet of patent leather: the whole
 * back of a coat answers the street's lights with one hard highlight. Real
 * cloth answers unevenly, so the highlight breaks up and moves as the body
 * moves. That unevenness is a specular property, not a colour, so it lives in
 * the roughness map rather than in the sheet the garment is painted on.
 *
 * The pattern is two crossed combs of threads, one warp and one weft, plus a
 * slub: a slow drift that keeps a run of threads from repeating exactly. It is
 * built here from the pixel's own coordinates, so it costs no download and the
 * same tile comes out every build.
 */
export class Weave {
  #size
  #threads
  #depth

  /** `threads` is how many threads run across the sheet; `depth` how far they dip roughness, 0 to 1. */
  constructor(size, { threads, depth }) {
    this.#size = size
    this.#threads = threads
    this.#depth = depth
  }

  /** What roughness at this pixel is multiplied by: 1 at a thread's crown, less in the gaps between. */
  at(index) {
    const x = index % this.#size
    const y = (index - x) / this.#size
    const pitch = (Math.PI * 2 * this.#threads) / this.#size
    const warp = Math.sin(x * pitch)
    const weft = Math.sin(y * pitch)
    // the crossing point of two threads is the crown; the gap between them dips
    const crossed = (warp * warp + weft * weft) / 2
    const slub = slur(x, y)
    return 1 - this.#depth * (1 - crossed) * (0.75 + 0.5 * slub)
  }
}

/** A slow, repeatable drift over the sheet, 0 to 1. Two coprime frequencies, so it does not tile visibly. */
function slur(x, y) {
  const a = Math.sin(x * 0.017 + y * 0.011)
  const b = Math.sin(x * 0.0043 - y * 0.0071)
  return (a * b + 1) / 2
}
