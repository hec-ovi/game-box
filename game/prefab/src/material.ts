import { CityNight } from '@gb/kitbash'
import type * as THREE from 'three'
import { attribute, float, texture, uv } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { LAYER_ATTRIBUTE, MATERIAL_NAME } from './pack.ts'

/**
 * How hard a lit face burns after dark. The pack stores glow at half strength
 * so a neon tube and a lit window fit one 8-bit map; this puts it back and
 * leaves a little over for the bloom pass to catch.
 */
export const GLOW = 2.6

/** Roughness and metalness of every prefab face: coated, dark, not a mirror. */
const SURFACE = { roughness: 0.68, metalness: 0.05 } as const

export interface PrefabAtlas {
  /** One layer per finish: the colour a face is painted. */
  readonly colour: THREE.DataArrayTexture
  /** The same layers, holding only what glows. */
  readonly emissive: THREE.DataArrayTexture
}

/**
 * The one material every prefab building in the city is drawn with. Which
 * picture a face wears rides on its vertices as a layer index into an array
 * texture, so a catalogue of hundreds of buildings on a dozen finishes is still
 * one material and, once `@gb/scene` has batched them, one draw.
 *
 * An array texture rather than an atlas because the producer's wall pictures
 * tile: a facade runs several bays across one wall, and only a layer of its own
 * lets the sampler wrap it without bleeding into the picture next door.
 *
 * Nothing glows in daylight. The lit windows and the neon are the emissive map
 * times the city's own night level, so at noon a facade is a dark wall with
 * painted windows and after dark it is the light in the street.
 */
export function prefabMaterial(atlas: PrefabAtlas, night: CityNight): THREE.Material {
  // the layer is one number for the whole triangle, so interpolation gives it
  // back unchanged; the half step is what keeps a rounding error off the edge
  const layer = attribute<'float'>(LAYER_ATTRIBUTE, 'float').add(float(0.5)).floor().toInt()

  const material = new MeshStandardNodeMaterial()
  material.name = MATERIAL_NAME
  material.colorNode = texture(atlas.colour, uv()).depth(layer)
  material.emissiveNode = texture(atlas.emissive, uv()).depth(layer).rgb.mul(float(GLOW)).mul(night.level)
  material.roughnessNode = float(SURFACE.roughness)
  material.metalnessNode = float(SURFACE.metalness)
  return material
}
