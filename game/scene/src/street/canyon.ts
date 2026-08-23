import { Rng } from '@gb/kit'
import * as THREE from 'three'

/** Equirectangular, and small: a wet road only ever reads it out of focus. */
const WIDTH = 128
const HEIGHT = 64

/** Where the signs, the shopfronts and the lit windows sit, as a share of the way down from straight up. */
const BANDS = {
  sky: 0.26,
  windows: 0.4,
  signs: 0.5,
} as const

/** Cyan and teal carry the street, with magenta, amber and green as the accents. */
const NEON: ReadonlyArray<readonly [number, number, number]> = [
  [0.08, 0.85, 0.95],
  [0.1, 0.95, 0.8],
  [0.2, 0.6, 1.0],
  [1.0, 0.15, 0.6],
  [1.0, 0.55, 0.12],
  [0.35, 1.0, 0.3],
]

/**
 * What a wet street has above it, painted rather than rendered.
 *
 * A road reflects the fronts of the buildings either side of it, and nothing a
 * material can reach carries them: `scene.environment` is prefiltered from the
 * sky, which at night is nearly black, and the signs and lit windows are
 * emissive geometry that no reflection probe in the scene has ever seen. The
 * two ways to reflect the real thing both cost a pass over the scene, so this
 * is the third: a small probe of what a lit street canyon looks like, read at a
 * mip chosen by how rough the wet surface is.
 *
 * It is structured up and down, where it has to be right, and only loosely
 * round the compass, where nobody can tell: an up facing plane only ever
 * reflects rays above the horizon, so the bright band lands in the distance and
 * the ground at your feet reflects the dark sky, which is what a wet street
 * does. Same seed, same reflections.
 */
export function canyonProbe(seed: string): THREE.DataTexture {
  const rng = new Rng(seed).fork('canyon')
  const pixels = new Float32Array(WIDTH * HEIGHT * 3)

  sky(pixels)
  for (const strip of strips(rng)) paint(pixels, strip)
  const data = toBytes(soften(pixels))

  const texture = new THREE.DataTexture(data, WIDTH, HEIGHT, THREE.RGBAFormat)
  texture.name = 'street:canyon'
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** How many mips the probe has, so a roughness can be turned into one. */
export const CANYON_MIPS = Math.log2(WIDTH)

interface Strip {
  /** Round the compass, 0 to 1, and how wide. */
  readonly at: number
  readonly width: number
  /** Down from straight up, 0 to 1. */
  readonly top: number
  readonly bottom: number
  readonly colour: readonly [number, number, number]
  readonly strength: number
}

/** The dark sky above, lifting a little towards the rooftops. */
function sky(pixels: Float32Array): void {
  for (let y = 0; y < HEIGHT; y++) {
    const down = (y + 0.5) / HEIGHT
    const lift = Math.max(0, (down - 0.05) / (BANDS.sky - 0.05))
    const glow = down < BANDS.signs ? 0.006 + 0.035 * Math.min(1, lift) ** 2 : 0
    for (let x = 0; x < WIDTH; x++) {
      const at = (y * WIDTH + x) * 3
      pixels[at] = glow * 0.55
      pixels[at + 1] = glow * 0.85
      pixels[at + 2] = glow
    }
  }
}

/** Signs down the sign band, lit windows above it, shopfront spill just over the horizon. */
function strips(rng: Rng): Strip[] {
  const out: Strip[] = []
  const signs = rng.fork('signs')
  for (let i = 0; i < 26; i++) {
    const top = signs.range(BANDS.windows, BANDS.signs - 0.045)
    out.push({
      at: signs.float(),
      width: signs.range(0.006, 0.03),
      top,
      bottom: signs.range(top + 0.03, BANDS.signs),
      colour: signs.pick(NEON),
      strength: signs.range(0.9, 3.4),
    })
  }

  const windows = rng.fork('windows')
  for (let i = 0; i < 40; i++) {
    const top = windows.range(0.08, BANDS.windows)
    out.push({
      at: windows.float(),
      width: windows.range(0.004, 0.014),
      top,
      bottom: top + windows.range(0.01, 0.05),
      colour: [1, windows.range(0.72, 0.9), windows.range(0.42, 0.62)],
      strength: windows.range(0.1, 0.4),
    })
  }

  const fronts = rng.fork('shopfronts')
  for (let i = 0; i < 18; i++) {
    out.push({
      at: fronts.float(),
      width: fronts.range(0.02, 0.07),
      top: fronts.range(BANDS.signs - 0.05, BANDS.signs - 0.02),
      bottom: BANDS.signs,
      colour: fronts.pick(NEON),
      strength: fronts.range(0.2, 0.9),
    })
  }
  return out
}

function paint(pixels: Float32Array, strip: Strip): void {
  const from = Math.floor(strip.top * HEIGHT)
  const to = Math.min(HEIGHT - 1, Math.ceil(strip.bottom * HEIGHT))
  const half = (strip.width * WIDTH) / 2

  for (let y = from; y <= to; y++) {
    for (let step = -Math.ceil(half); step <= Math.ceil(half); step++) {
      const across = Math.abs(step) / Math.max(half, 0.5)
      const fade = Math.max(0, 1 - across * across)
      const x = ((Math.round(strip.at * WIDTH) + step) % WIDTH + WIDTH) % WIDTH
      const at = (y * WIDTH + x) * 3
      const light = strip.strength * fade
      pixels[at] = pixels[at]! + strip.colour[0] * light
      pixels[at + 1] = pixels[at + 1]! + strip.colour[1] * light
      pixels[at + 2] = pixels[at + 2]! + strip.colour[2] * light
    }
  }
}

/**
 * Blurs round the compass and not up and down.
 *
 * Which way a reflected ray points round the compass changes slowly across a
 * flat road, so any hard edge there smears into a large flat patch of one
 * colour, which reads as a coloured light rather than as a reflection. How high
 * the ray points changes quickly, and that is the axis the bands have to stay
 * crisp on: it is what puts the bright band down the street rather than at your
 * feet.
 */
function soften(pixels: Float32Array, passes = 7): Float32Array {
  let from = pixels
  for (let pass = 0; pass < passes; pass++) {
    const out = new Float32Array(pixels.length)
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        for (let channel = 0; channel < 3; channel++) {
          let total = 0
          for (let step = -1; step <= 1; step++) {
            total += from[(y * WIDTH + ((x + step + WIDTH) % WIDTH)) * 3 + channel]! * (step === 0 ? 0.5 : 0.25)
          }
          out[(y * WIDTH + x) * 3 + channel] = total
        }
      }
    }
    from = out
  }
  return from
}

/** The sRGB transfer the texture is read back through, so what is painted is what is reflected. */
function encode(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
}

/** Nothing below the horizon: an up facing plane never reflects it. */
function toBytes(pixels: Float32Array): Uint8Array {
  const data = new Uint8Array(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y++) {
    const below = (y + 0.5) / HEIGHT > BANDS.signs
    for (let x = 0; x < WIDTH; x++) {
      const at = y * WIDTH + x
      for (let channel = 0; channel < 3; channel++) {
        const value = below ? 0 : Math.min(1, pixels[at * 3 + channel]!)
        data[at * 4 + channel] = Math.round(encode(value) * 255)
      }
      data[at * 4 + 3] = 255
    }
  }
  return data
}
