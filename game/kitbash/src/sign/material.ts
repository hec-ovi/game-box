import type * as THREE from 'three'
import { attribute, float, mix, texture, uv, vec3 } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import type { CityNight } from '../night/night.ts'
import { SIGN } from './sign.ts'

/**
 * The one material every sign in the city is drawn with. The letters come out
 * of the atlas, the colours off the vertices, so a thousand buildings with a
 * thousand different names and colours are still one material and, once
 * `@gb/scene` has batched them, one draw.
 *
 * By day a tube is pale glass on a dark box, lit by the sun like anything else.
 * After dark the emissive comes up with the city's own night level, which is
 * what the bloom pass has to catch: the halo is light, never geometry.
 */
export const SIGN_ATTRIBUTES = { ink: 'signInk', panel: 'signPanel', glow: 'signGlow' } as const

/** How much of a tube's colour survives into daylight, and what it fades toward. */
const DAYLIGHT = { toward: 0.66, blend: 0.55 } as const

export function signMaterial(night: CityNight, atlas: THREE.Texture): THREE.Material {
  const cover = texture(atlas, uv()).r
  const ink = attribute<'vec3'>(SIGN_ATTRIBUTES.ink, 'vec3')
  const panel = attribute<'vec3'>(SIGN_ATTRIBUTES.panel, 'vec3')
  const glow = attribute<'vec2'>(SIGN_ATTRIBUTES.glow, 'vec2')

  const material = new MeshStandardNodeMaterial()
  material.name = SIGN.material
  material.colorNode = mix(panel, mix(ink, vec3(DAYLIGHT.toward, DAYLIGHT.toward, DAYLIGHT.toward + 0.02), float(DAYLIGHT.blend)), cover)
  material.roughnessNode = float(0.42)
  material.metalnessNode = float(0)
  material.emissiveNode = mix(panel.mul(glow.y), ink.mul(glow.x), cover).mul(float(night.level)).mul(float(SIGN.glow))
  return material
}
