import { Rng } from '@gb/kit'
import * as THREE from 'three'

/** One tile, in texels. Power of two so it can carry mipmaps. */
const SIZE = 256

/**
 * The four fields the street surface is weathered with, in one tiling texture.
 * Nothing here knows how big a tile is: the material picks a real-world size
 * per channel, so the same texture carries chippings a couple of centimetres
 * across and road repairs several metres across.
 *
 * - `r` broad blobs, for standing water
 * - `g` mid-scale mottling, for staining and tyre dirt
 * - `b` rectangular patches, for a stretch of road that has been dug up
 * - `a` fine speckle, for aggregate
 */
export function surfaceNoise(seed: string): THREE.DataTexture {
  const rng = new Rng(seed)
  const data = new Uint8Array(SIZE * SIZE * 4)

  write(data, 0, fractal(rng.fork('pools'), [4, 8], [0.7, 0.3]))
  write(data, 1, fractal(rng.fork('stain'), [6, 12, 24], [0.55, 0.3, 0.15]))
  write(data, 2, patches(rng.fork('repairs')))
  write(data, 3, fractal(rng.fork('grit'), [32, 64, 128], [0.4, 0.35, 0.25]))

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat)
  texture.name = 'street:noise'
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function write(data: Uint8Array, channel: number, field: Float32Array): void {
  for (let at = 0; at < SIZE * SIZE; at++) data[at * 4 + channel] = Math.round(Math.max(0, Math.min(1, field[at]!)) * 255)
}


/** Several octaves of wrapping value noise, added at the weights given. */
function fractal(rng: Rng, periods: readonly number[], weights: readonly number[]): Float32Array {
  const out = new Float32Array(SIZE * SIZE)
  let total = 0
  periods.forEach((period, octave) => {
    const weight = weights[octave] ?? 0
    total += weight
    const lattice = latticeOf(rng.fork(`octave-${octave}`), period)
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        out[y * SIZE + x]! += weight * sample(lattice, period, (x / SIZE) * period, (y / SIZE) * period)
      }
    }
  })
  for (let at = 0; at < out.length; at++) out[at] = out[at]! / total
  return out
}

function latticeOf(rng: Rng, period: number): Float32Array {
  const lattice = new Float32Array(period * period)
  for (let at = 0; at < lattice.length; at++) lattice[at] = rng.float()
  return lattice
}

/** Value noise at one octave, wrapping at the period so the tile has no seam. */
function sample(lattice: Float32Array, period: number, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = ease(x - x0)
  const fy = ease(y - y0)
  const at = (ix: number, iy: number) => lattice[(((iy % period) + period) % period) * period + (((ix % period) + period) % period)]!
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx
  return top * (1 - fy) + bottom * fy
}

function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Rectangles of a different shade, the way a road wears where it has been opened up and filled in. */
function patches(rng: Rng): Float32Array {
  const out = new Float32Array(SIZE * SIZE).fill(0.5)
  for (let i = 0; i < 14; i++) {
    const w = Math.floor(rng.range(SIZE / 12, SIZE / 4))
    const h = Math.floor(rng.range(SIZE / 14, SIZE / 5))
    const x0 = Math.floor(rng.range(0, SIZE))
    const y0 = Math.floor(rng.range(0, SIZE))
    const shade = rng.range(0.12, 0.9)
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        out[(((y0 + dy) % SIZE) * SIZE) + ((x0 + dx) % SIZE)] = shade
      }
    }
  }
  return out
}
