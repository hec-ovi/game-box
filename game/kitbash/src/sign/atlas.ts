import * as THREE from 'three'
import { GLYPH_KEYS, GLYPHS, GRID, type Glyph } from './glyphs.ts'

/**
 * One texture holding every letter the city can write, rasterised from the
 * stroke font at load. It is a font, not a sheet of finished signs: a sign is a
 * run of quads, one per letter, so a thousand buildings with a thousand
 * different names still read one fixed-size texture and cost one draw.
 *
 * A stroke becomes a round-capped tube with a soft shoulder round it, so a
 * letter reads as a lit tube on its own and blooms into a halo when the post
 * process is on.
 */

/** The grid the atlas is cut into. Square and power of two, so it mips. */
const ATLAS = { size: 512, columns: 12, rows: 8 } as const

/** One cell of the grid, in pixels. */
const CELL = { width: 42, height: 64 } as const

/** The part of a cell a quad's uv covers. The rest is margin, so mips do not bleed. */
const INK = { width: 37, height: 56 } as const

/** Where the 4 by 6 drawing grid lands inside the ink box, leaving side bearing. */
const DRAW = { width: 31, height: 50 } as const

/** Half the tube thickness, in pixels, at this cell size. */
const TUBE = 2.6

/** How far past the tube the shoulder carries, and how bright it is there. */
const SHOULDER = { reach: 3.2, level: 0.34 }

/** How wide and tall one glyph quad is, relative to each other. */
export const GLYPH_ASPECT = INK.width / INK.height

/** How many cells the atlas can hold. */
export const ATLAS_CELLS = ATLAS.columns * ATLAS.rows

/** Where one cell's ink sits in the texture: `[u0, v0, u1, v1]`. */
export function cellUv(cell: string): readonly [number, number, number, number] {
  const at = GLYPH_KEYS.indexOf(cell)
  const index = at < 0 ? GLYPH_KEYS.indexOf(' ') : at
  const column = index % ATLAS.columns
  const row = Math.floor(index / ATLAS.columns)
  const x = column * CELL.width + (CELL.width - INK.width) / 2
  const y = row * CELL.height + (CELL.height - INK.height) / 2
  return [x / ATLAS.size, y / ATLAS.size, (x + INK.width) / ATLAS.size, (y + INK.height) / ATLAS.size]
}

/** Which cell a `[u, v]` inside the atlas belongs to. The inverse of `cellUv`. */
export function cellAt(u: number, v: number): string | undefined {
  const column = Math.floor((u * ATLAS.size) / CELL.width)
  const row = Math.floor((v * ATLAS.size) / CELL.height)
  return GLYPH_KEYS[row * ATLAS.columns + column]
}

let pixels: Uint8Array | undefined

/**
 * The coverage of every cell, one byte a pixel. Pure and the same every run, so
 * it is drawn once for the process however many kits are loaded.
 */
export function atlasPixels(): Uint8Array {
  if (pixels) return pixels
  if (GLYPH_KEYS.length > ATLAS_CELLS) throw new Error(`kitbash: ${GLYPH_KEYS.length} glyphs will not fit ${ATLAS_CELLS} atlas cells`)

  const drawn = new Uint8Array(ATLAS.size * ATLAS.size)
  GLYPH_KEYS.forEach((key, index) => {
    const column = index % ATLAS.columns
    const row = Math.floor(index / ATLAS.columns)
    draw(drawn, GLYPHS[key]!, column * CELL.width, row * CELL.height)
  })
  pixels = drawn
  return drawn
}

/** The atlas as a texture. One per loaded kit; the pixels behind it are shared. */
export function signAtlas(): THREE.DataTexture {
  const texture = new THREE.DataTexture(atlasPixels(), ATLAS.size, ATLAS.size, THREE.RedFormat, THREE.UnsignedByteType)
  texture.name = 'kit:sign-atlas'
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

/** One glyph into the sheet, with the cell's bottom-left corner at `[atX, atY]`. */
function draw(into: Uint8Array, glyph: Glyph, atX: number, atY: number): void {
  const originX = atX + (CELL.width - DRAW.width) / 2
  const originY = atY + (CELL.height - DRAW.height) / 2
  const inkX = atX + (CELL.width - INK.width) / 2
  const inkY = atY + (CELL.height - INK.height) / 2

  if (glyph.fill) {
    for (let y = Math.ceil(inkY); y < inkY + INK.height; y++) {
      for (let x = Math.ceil(inkX); x < inkX + INK.width; x++) into[y * ATLAS.size + x] = 255
    }
    return
  }

  const radius = TUBE * (glyph.weight ?? 1)
  const segments = strokesOf(glyph, originX, originY)
  if (segments.length === 0) return

  for (let y = atY; y < atY + CELL.height; y++) {
    for (let x = atX; x < atX + CELL.width; x++) {
      const distance = nearest(segments, x + 0.5, y + 0.5)
      const core = span(radius + 0.5, radius - 0.5, distance)
      const shoulder = span(radius * SHOULDER.reach, radius, distance) * SHOULDER.level
      const value = Math.min(1, core + shoulder * (1 - core))
      if (value <= 0) continue
      const at = y * ATLAS.size + x
      into[at] = Math.max(into[at]!, Math.round(value * 255))
    }
  }
}

/** Every stroke of a glyph as segments in atlas pixels. */
function strokesOf(glyph: Glyph, originX: number, originY: number): Float64Array {
  const out: number[] = []
  for (const stroke of glyph.strokes) {
    for (let at = 0; at < Math.max(1, stroke.length - 1); at++) {
      const from = stroke[at]
      const to = stroke[at + 1] ?? from
      if (!from || !to) continue
      out.push(
        originX + (from[0] / GRID.width) * DRAW.width,
        originY + (from[1] / GRID.height) * DRAW.height,
        originX + (to[0] / GRID.width) * DRAW.width,
        originY + (to[1] / GRID.height) * DRAW.height,
      )
    }
  }
  return Float64Array.from(out)
}

/** Distance from a point to the nearest of a run of segments. */
function nearest(segments: Float64Array, x: number, y: number): number {
  let best = Infinity
  for (let at = 0; at < segments.length; at += 4) {
    const [ax, ay, bx, by] = [segments[at]!, segments[at + 1]!, segments[at + 2]!, segments[at + 3]!]
    const [dx, dy] = [bx - ax, by - ay]
    const length = dx * dx + dy * dy
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length))
    best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)))
  }
  return best
}

/** 1 at `full`, 0 at `none`, smooth between. */
function span(none: number, full: number, at: number): number {
  if (none === full) return at <= full ? 1 : 0
  const t = Math.max(0, Math.min(1, (none - at) / (none - full)))
  return t * t * (3 - 2 * t)
}
