import type { Rng } from '@gb/kit'
import * as THREE from 'three'
import { clamp01, smoothstep01 } from './height.ts'
import { Noise } from './noise.ts'

/**
 * Texels round the compass and from pole to pole: a texel is a little under a
 * degree, and nothing painted here is finer than three of them.
 */
const WIDTH = 384
const HEIGHT = 192

/** How wide the galaxy's band and its bright inner ridge are, as a sine of the angle off the plane, and how far out it is worth painting. */
const BAND = 0.15
const RIDGE = 0.055
const BAND_EDGE = 0.5
/** Noise sizes, in units of the unit sphere: the galaxy's shape, its dust, the wash of unresolved stars. */
const SHAPE = 2.6
const DUST = 7
const GRAIN = 18
/** How high the city's glow reaches above the horizon and how far it dies away below it, as a sine of the angle. */
const GLOW_REACH = 0.34
const GLOW_FLOOR = 0.16

/** The colours the wash of unresolved stars runs between: cool at the edge of the band, warm in its core. */
const RIM = { r: 0.44, g: 0.56, b: 0.86 }
const CORE = { r: 0.96, g: 0.90, b: 0.78 }

/**
 * The night sky the dome wears: the galaxy's band with its dust lanes, the
 * grain of the stars too faint to draw one at a time, and the light the city
 * throws back up at the horizon.
 *
 * It is painted from the world's seed as a function of the direction you are
 * looking, which is what makes it seamless by construction: every texel is
 * `f(dir)`, so the two edges of the equirectangular sheet are the same
 * direction and agree, and every texel of the top row is straight up. An image
 * of a sky has to be cut and stitched to get that, and the cut shows at the
 * poles.
 *
 * RGB is the sky itself and alpha is the city's glow, kept apart because the
 * two fade on different schedules: cloud puts the stars out and makes the glow
 * stronger. Both are painted at full strength; how much of either is showing is
 * the dome's business, and so is what colour the glow is, so a place can have
 * its own sodium or its own neon without repainting the sheet.
 */
export function paintNightSky(pole: THREE.Vector3, rng: Rng): THREE.DataTexture {
  const shape = sphereNoise(rng)
  const dust = sphereNoise(rng)
  const grain = sphereNoise(rng)
  const lobes = sphereNoise(rng)

  const data = new Uint8Array(WIDTH * HEIGHT * 4)
  const dir = new THREE.Vector3()

  for (let row = 0; row < HEIGHT; row++) {
    const polar = ((row + 0.5) / HEIGHT) * Math.PI
    const ring = Math.sin(polar)
    const up = Math.cos(polar)
    for (let col = 0; col < WIDTH; col++) {
      const azimuth = ((col + 0.5) / WIDTH - 0.5) * Math.PI * 2
      dir.set(Math.cos(azimuth) * ring, up, Math.sin(azimuth) * ring)
      const at = (row * WIDTH + col) * 4

      // the galaxy, and only near it: three quarters of a sphere is empty sky
      // and there is no point paying noise for it
      let band = 0
      let lanes = 1
      let clumps = 1
      if (Math.abs(dir.dot(pole)) < BAND_EDGE) {
        // off the galactic plane, softened by a low-frequency wobble so the band
        // is a river rather than a stripe
        const off = Math.abs(dir.dot(pole) + 0.08 * shape.fbm(dir, SHAPE, 1))
        // a broad haze with a bright ridge down the middle of it
        band = Math.exp(-((off / BAND) ** 2)) + 0.7 * Math.exp(-((off / RIDGE) ** 2))
        // dark clouds lying in front of the band, only where there is band to hide
        lanes = 1 - 0.85 * clamp01(band) * clamp01(dust.fbm(dir, DUST, 2) * 1.7 + 0.1)
        clumps = 0.35 + 0.65 * clamp01(shape.fbm(dir, SHAPE * 2.1, 2) + 0.5)
      }

      // the stars nobody can resolve: peaks of fine noise, thick in the band
      const speck = Math.max(0, grain.fbm(dir, GRAIN, 2)) ** 5
      const wash = (0.1 + 0.9 * clamp01(band)) * speck * 6

      const light = band * clumps * lanes * 0.42 + wash
      const warmth = clamp01(band * lanes)
      data[at] = level(light * (RIM.r + (CORE.r - RIM.r) * warmth))
      data[at + 1] = level(light * (RIM.g + (CORE.g - RIM.g) * warmth))
      data[at + 2] = level(light * (RIM.b + (CORE.b - RIM.b) * warmth))

      // the city, all round the compass and brighter in some quarters than
      // others, thinning out as you look up away from it and dying below it:
      // nothing under the horizon is ever seen, and a lower half left glowing
      // would light the ground from underneath through the prefiltered dome
      if (up >= GLOW_REACH || up <= -GLOW_FLOOR) continue
      const height = smoothstep01((GLOW_REACH - up) / GLOW_REACH) * smoothstep01((up + GLOW_FLOOR) / GLOW_FLOOR)
      const quarter = 0.45 + 0.55 * clamp01(lobes.fbm(dir, 0.9, 1) + 0.6)
      const mottle = 0.72 + 0.28 * clamp01(lobes.fbm(dir, 5.5, 2) + 0.5)
      data[at + 3] = level(height * height * quarter * mottle)
    }
  }

  const texture = new THREE.DataTexture(data, WIDTH, HEIGHT, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  // the sheet wraps round the compass and stops at the poles
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  // nothing painted here is finer than a couple of texels, so there is nothing
  // for a mip chain to save: skipping it also skips the seam a mip picks at the
  // meridian where the wrap makes the texture coordinate jump a whole turn
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

/**
 * How much of the sheet's light and glow the upper half of the sky carries on
 * average, each 0 to 1 at the painted strength: what the sheet adds to the
 * dome's mean brightness once the dome's own fades are applied.
 */
export function nightSkyMeans(texture: THREE.DataTexture): { light: number; glow: number } {
  const data = texture.image.data as Uint8Array
  let light = 0
  let glow = 0
  let weight = 0
  for (let row = 0; row < HEIGHT / 2; row++) {
    const ring = Math.sin(((row + 0.5) / HEIGHT) * Math.PI)
    for (let col = 0; col < WIDTH; col++) {
      const at = (row * WIDTH + col) * 4
      light += (ring * (0.2126 * data[at]! + 0.7152 * data[at + 1]! + 0.0722 * data[at + 2]!)) / 255
      glow += (ring * data[at + 3]!) / 255
      weight += ring
    }
  }
  return { light: light / weight, glow: glow / weight }
}

/** Where the galaxy's plane stands: the axis it is drawn at right angles to. The stars read it too. */
export function galacticPole(rng: Rng): THREE.Vector3 {
  // kept off vertical, so the band crosses the sky at an angle rather than
  // ringing the horizon or sitting flat overhead
  const tilt = rng.range(0.35, 0.85)
  const turn = rng.float() * Math.PI * 2
  const ring = Math.sqrt(Math.max(0, 1 - tilt * tilt))
  return new THREE.Vector3(Math.cos(turn) * ring, tilt, Math.sin(turn) * ring).normalize()
}

function level(value: number): number {
  return Math.round(clamp01(value) * 255)
}

/**
 * Noise over a direction rather than over a plane, built out of three planar
 * lookups. Continuous everywhere on the sphere, which is the whole point: a
 * sheet painted through this has no edge to hide and no pole to pinch.
 */
function sphereNoise(rng: Rng): { fbm(dir: THREE.Vector3, scale: number, octaves: number): number } {
  const a = new Noise(rng.int(0, 0x7fffffff))
  const b = new Noise(rng.int(0, 0x7fffffff))
  const c = new Noise(rng.int(0, 0x7fffffff))
  return {
    fbm(dir, scale, octaves) {
      const x = dir.x * scale
      const y = dir.y * scale
      const z = dir.z * scale
      return (a.fbm(x, y, octaves) + b.fbm(y, z, octaves) + c.fbm(z, x, octaves)) / 3
    },
  }
}
