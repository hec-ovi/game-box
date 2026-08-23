import * as THREE from 'three'
import { clamp, float, mix, positionWorld, smoothstep, texture, vec2, vec3 } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import type { FloatNode } from '../night/nodes.ts'
import { UNTONED, type Tone } from './tones.ts'

/**
 * The kit's own materials, taken to the tone the town is in and dirtied.
 *
 * A kit material is a white factor over a texture set, so tinting it is
 * multiplying: the brick keeps its bond and the concrete keeps its pitting,
 * and only the value and the hue move. Over the top of that go two samples of
 * one generated tiling sheet, one for the blotches a wall weathers into and one
 * for the streaks that run down it, weighted toward the pavement where the
 * traffic throws its dirt.
 *
 * Materials somebody else owns are handed back untouched: the window shader,
 * the lamp, and the plane the kit paints behind its glass.
 */

/** How large the dirt is on the wall: metres per tile, blotches and streaks. */
const SCALE = { blotch: 13, streak: 2.6, smear: 11 } as const

/** How far up the wall the traffic throws its dirt, in metres. */
const KERB = 5.5

export function toneMaterials(source: ReadonlyMap<string, THREE.Material>, tone: Tone, grime: THREE.Texture): Map<string, THREE.Material> {
  const dirt = dirtOf(grime, tone.grime)
  const toned = new Map<string, THREE.Material>()
  for (const [name, material] of source) {
    toned.set(name, UNTONED.includes(name) || !(material instanceof THREE.MeshStandardMaterial) ? material : dressed(name, material, tone, dirt))
  }
  return toned
}

/** One kit material, tinted and dirtied, as a node material. */
function dressed(name: string, source: THREE.MeshStandardMaterial, tone: Tone, dirt: FloatNode): THREE.Material {
  const tint = new THREE.Color(tone.tint[name] ?? tone.rest)
  const albedo = source.map ? texture(source.map).rgb.mul(vec3(tint.r, tint.g, tint.b)) : vec3(tint.r, tint.g, tint.b)
  const rough = source.roughnessMap ? texture(source.roughnessMap).g.mul(source.roughness) : float(source.roughness)

  const material = new MeshStandardNodeMaterial()
  material.name = name
  material.normalMap = source.normalMap
  material.normalScale = source.normalScale.clone()
  material.side = source.side
  // grime takes the colour down and the shine off; the sheen lifts what is left,
  // because a wall with no specular at all is a fill rather than a surface
  material.colorNode = albedo.mul(float(1).sub(dirt.mul(0.62)))
  material.roughnessNode = clamp(mix(rough, float(1), dirt.mul(0.4)).sub(float(tone.sheen * 0.3)), float(0.22), float(1))
  material.metalnessNode = source.metalnessMap ? texture(source.metalnessMap).b.mul(source.metalness) : float(source.metalness)
  return material
}

/** How dirty this bit of wall is, 0 to 1. */
function dirtOf(grime: THREE.Texture, amount: number): FloatNode {
  // a wall is vertical, so the sheet is laid on "along the wall" by "up it"
  const along = positionWorld.x.add(positionWorld.z)
  const blotch = texture(grime, vec2(along.div(SCALE.blotch), positionWorld.y.div(SCALE.blotch))).r
  const streak = texture(grime, vec2(along.div(SCALE.streak), positionWorld.y.div(SCALE.smear))).g
  const low = smoothstep(float(KERB), float(0.3), positionWorld.y)

  return clamp(blotch.mul(0.55).add(streak.mul(0.45)).mul(mix(float(0.45), float(1), low)).mul(float(amount)), float(0), float(1))
}
