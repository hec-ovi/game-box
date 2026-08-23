import * as THREE from 'three'

/**
 * The dirt on the city, drawn from code into one small tiling texture: broad
 * blotches in the red channel, rain streaks in the green one.
 *
 * It is a texture rather than noise in the shader because a facade fills the
 * screen and two fetches are a rounding error where four octaves of Perlin per
 * fragment are not. Nothing is downloaded: the pattern is a hash, so a world
 * file carries its own weather.
 */

/** Square and power of two, so it mips and wraps. */
const SIZE = 256

/** The lattices the blotches are built from, coarse to fine, and how much each carries. */
const OCTAVES: ReadonlyArray<readonly [number, number]> = [[4, 0.52], [8, 0.26], [16, 0.14], [32, 0.08]]

/** How wide a streak is, and how slowly it fades down the wall. */
const STREAK = { across: 48, down: 4 } as const

let pixels: Uint8Array | undefined

/** The two channels, one byte each. Pure, so it is drawn once for the process. */
export function grimePixels(): Uint8Array {
  if (pixels) return pixels

  const drawn = new Uint8Array(SIZE * SIZE * 2)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE
      const v = y / SIZE
      let blotch = 0
      for (const [lattice, weight] of OCTAVES) blotch += noise(u * lattice, v * lattice, lattice) * weight
      // a streak is narrow across the wall and long down it, and fades in and out
      const streak = noise(u * STREAK.across, v * 1.6, STREAK.across) * noise(u * 3, v * STREAK.down, STREAK.down)
      const at = (y * SIZE + x) * 2
      drawn[at] = byte(blotch)
      drawn[at + 1] = byte(streak * 1.35)
    }
  }
  pixels = drawn
  return drawn
}

/** The dirt as a texture, repeating in both directions. */
export function grimeTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(grimePixels(), SIZE, SIZE, THREE.RGFormat, THREE.UnsignedByteType)
  texture.name = 'kit:grime'
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

/** Value noise on a lattice that wraps at `period`, so the sheet tiles. */
function noise(x: number, y: number, period: number): number {
  const [ix, iy] = [Math.floor(x), Math.floor(y)]
  const [fx, fy] = [ease(x - ix), ease(y - iy)]
  const a = lattice(ix, iy, period)
  const b = lattice(ix + 1, iy, period)
  const c = lattice(ix, iy + 1, period)
  const d = lattice(ix + 1, iy + 1, period)
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy
}

/** One lattice point, hashed. */
function lattice(x: number, y: number, period: number): number {
  const wrapped = (((x % period) + period) % period) * 374761393 + (((y % period) + period) % period) * 668265263
  let hash = Math.imul(wrapped ^ (wrapped >>> 13), 1274126177)
  hash ^= hash >>> 16
  return (hash >>> 0) / 4294967296
}

function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)))
}
