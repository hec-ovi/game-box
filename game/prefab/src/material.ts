import { CityNight } from '@gb/kitbash'
import type * as THREE from 'three'
import { float, mix, texture, uv } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { InteriorWindows, ROOM } from './interior.ts'
import { layerIndex } from './layer.ts'
import { MATERIAL_NAME } from './pack.ts'

/**
 * How hard a lit face burns after dark. The pack stores glow at half strength
 * so a neon tube and a lit window fit one 8-bit map; this puts it back and
 * leaves a little over for the bloom pass to catch.
 */
export const GLOW = 2.6

/** Roughness and metalness of a prefab wall: coated, dark, not a mirror. */
const SURFACE = { roughness: 0.68, metalness: 0.05 } as const

export interface PrefabAtlas {
  /** One layer per finish: the colour a face is painted. */
  readonly colour: THREE.DataArrayTexture
  /** The same layers, holding only what glows. */
  readonly emissive: THREE.DataArrayTexture
  /** The rooms a window looks into, one per layer. */
  readonly rooms: THREE.DataArrayTexture
  /** What each layer of the two facade textures paints, in order. */
  readonly finishes: readonly string[]
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
 * The windows are not in the picture. `InteriorWindows` cuts them out of the
 * wall arithmetically and draws the room behind each one, so a facade has depth
 * through it from the pavement instead of a lit rectangle.
 *
 * Nothing glows in daylight. The rooms and the neon are the night level times
 * what is behind the glass, so at noon a facade is a dark wall with dim rooms
 * in it and after dark it is the light in the street.
 */
export function prefabMaterial(atlas: PrefabAtlas, night: CityNight): THREE.Material {
  const layer = layerIndex()
  const wall = texture(atlas.colour, uv()).depth(layer)
  const burning = texture(atlas.emissive, uv()).depth(layer).rgb.mul(float(GLOW))
  const { light, share } = new InteriorWindows(atlas.rooms, night, atlas.finishes).glazing()

  const material = new MeshStandardNodeMaterial()
  material.name = MATERIAL_NAME
  material.colorNode = mix(wall.rgb, light.mul(float(ROOM.albedo)), share)
  material.emissiveNode = mix(burning, light.mul(float(ROOM.glow)), share).mul(night.level)
  material.roughnessNode = mix(float(SURFACE.roughness), float(ROOM.roughness), share)
  material.metalnessNode = float(SURFACE.metalness)
  return material
}
