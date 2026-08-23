import type { Rng } from '@gb/kit'
import * as THREE from 'three'
import { clamp01, smoothstep01 } from './height.ts'
import { Noise } from './noise.ts'

/** Drawn after the stars, so the ones behind it go out. */
const MOON_ORDER = -998

/** Texels across the painted face. Two triangles carry it. */
const FACE = 128
/** The moon's own radius as a fraction of the face's half width. The rest is halo. */
const DISC = 0.5
/** Dark patches on the near side. They overlap, which is what makes them irregular. */
const MARIA = 11
/** Pale highland rock, in sRGB, which is what the texture is read as. */
const ROCK = { r: 0xdd, g: 0xe5, b: 0xf2 }
/** The cooler grey the maria pull that rock towards. */
const BASALT = { r: 0x8e, g: 0x9c, b: 0xb4 }
/** How much of the disc's brightness the glow just outside it carries. */
const HALO = 0.12
/** What is left on the unlit side: the earth shining back onto it. */
const EARTHSHINE = 0.055

interface Mare {
  /** A point on the near hemisphere, in the face's own frame. */
  readonly x: number
  readonly y: number
  readonly z: number
  /** Angular radius, radians, and how much rock it darkens. */
  readonly size: number
  readonly depth: number
}

/**
 * A moon that reads as a moon at the forty pixels it actually covers: maria,
 * a limb that darkens to the edge, a soft halo and a phase with a terminator
 * across it.
 *
 * It is one sprite carrying one generated texture, so it always faces the
 * camera, costs two triangles and downloads nothing. The phase is drawn from
 * the seed and then stays put: this box is handed an hour of the day and no
 * date, and the moon it hangs is the point opposite the sun, so there is no
 * clock here that a phase could honestly follow. A world's moon is the same
 * moon every night, and a different one in the next world.
 */
export function buildMoon(radius: number, rng: Rng): THREE.Sprite {
  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: paintFace(rng),
      transparent: true,
      // blended, so this draws after every solid thing in the frame: it has to
      // depth-test or it paints over the roofs it should be rising behind
      depthTest: true,
      depthWrite: false,
      fog: false,
    }),
  )
  moon.name = 'land:moon-disc'
  // the face is two half widths across and the disc fills DISC of one of them
  moon.scale.setScalar((radius / DISC) * 2)
  moon.renderOrder = MOON_ORDER
  moon.frustumCulled = false
  return moon
}

/** Paints the whole face once, disc and halo, into an RGBA texture. */
function paintFace(rng: Rng): THREE.DataTexture {
  const maria = scatterMaria(rng)
  const grain = new Noise(rng.int(0, 0x7fffffff))
  const lit = illumination(rng)

  // the glow leans to the lit side, so the dark limb is not ringed with light
  const sideways = Math.hypot(lit.x, lit.y) || 1
  const towards = { x: lit.x / sideways, y: lit.y / sideways }

  const data = new Uint8Array(FACE * FACE * 4)
  for (let row = 0; row < FACE; row++) {
    const v = ((row + 0.5) / FACE) * 2 - 1
    for (let col = 0; col < FACE; col++) {
      const u = ((col + 0.5) / FACE) * 2 - 1
      const r = Math.hypot(u, v)

      // 1 well inside the disc, 0 outside it, soft over a couple of texels
      const solid = smoothstep01((DISC - r) * FACE * 0.5)
      const lean = 0.05 + 0.95 * smoothstep01(0.5 + (0.5 * (u * towards.x + v * towards.y)) / Math.max(r, 1e-4))
      const glow = HALO * lean * (1 - smoothstep01((r - DISC) / (1 - DISC))) ** 5
      const alpha = solid + (1 - solid) * glow
      const at = (row * FACE + col) * 4
      if (alpha <= 0.002) continue

      const rock = solid > 0 ? surface(u / DISC, v / DISC, maria, grain, lit) : { level: 1, mare: 0 }
      // composite the disc over the glow, then take the colour back out of it
      const level = clamp01((solid * rock.level + (1 - solid) * glow) / alpha)
      data[at] = channel(level, ROCK.r, BASALT.r, rock.mare)
      data[at + 1] = channel(level, ROCK.g, BASALT.g, rock.mare)
      data[at + 2] = channel(level, ROCK.b, BASALT.b, rock.mare)
      data[at + 3] = Math.round(clamp01(alpha) * 255)
    }
  }

  const texture = new THREE.DataTexture(data, FACE, FACE, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

/** One colour channel of the rock at this brightness, this much of it mare. */
function channel(level: number, rock: number, basalt: number, mare: number): number {
  return Math.round(level * (rock + (basalt - rock) * mare))
}

/**
 * How bright the rock is at one point of the disc, and how much of that point
 * is mare rather than highland. `x` and `y` are the point in disc radii.
 */
function surface(
  x: number,
  y: number,
  maria: readonly Mare[],
  grain: Noise,
  lit: THREE.Vector3,
): { level: number; mare: number } {
  // the sphere the flat disc is a picture of, which is what foreshortens the
  // maria towards the edge and gives the terminator its curve
  const z = Math.sqrt(Math.max(0, 1 - x * x - y * y))

  // a ragged edge on every patch, so they are seas rather than circles
  const ragged = 0.78 + 0.34 * grain.value(x * 3.5, y * 3.5)
  let mare = 0
  for (const patch of maria) {
    const away = Math.acos(clamp01(x * patch.x + y * patch.y + z * patch.z))
    mare += patch.depth * (1 - smoothstep01(away / (patch.size * ragged)))
  }
  mare = clamp01(mare)

  const albedo = (1 - mare * 0.5) * (0.9 + 0.2 * grain.fbm(x * 9, y * 9, 4))
  const limb = 0.66 + 0.34 * z ** 0.45
  const lambert = x * lit.x + y * lit.y + z * lit.z
  const day = EARTHSHINE + (1 - EARTHSHINE) * smoothstep01((lambert + 0.04) / 0.3)
  return { level: albedo * limb * day, mare }
}

/** Where the sunlight comes from, in the face's frame: the phase, in one vector. */
function illumination(rng: Rng): THREE.Vector3 {
  // 0 would be a full moon and pi a new one. Kept between the two so there is
  // always a terminator to tell it is a sphere and always enough of it lit to
  // go with the moonlight on the ground.
  const phase = rng.range(0.75, 1.75) * (rng.chance(0.5) ? 1 : -1)
  return new THREE.Vector3(Math.sin(phase), rng.range(-0.25, 0.25), Math.cos(phase)).normalize()
}

/** Dark patches over the near side, biased away from the exact centre. */
function scatterMaria(rng: Rng): Mare[] {
  const maria: Mare[] = []
  for (let patch = 0; patch < MARIA; patch++) {
    const angle = rng.float() * Math.PI * 2
    const ring = rng.float() ** 0.7 * 0.85
    maria.push({
      x: Math.cos(angle) * ring,
      y: Math.sin(angle) * ring,
      z: Math.sqrt(Math.max(0, 1 - ring * ring)),
      size: rng.range(0.14, 0.42),
      depth: rng.range(0.2, 0.6),
    })
  }
  return maria
}
