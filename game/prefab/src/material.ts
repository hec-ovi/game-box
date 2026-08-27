import type { CityNight } from '@gb/kitbash'
import type * as THREE from 'three'
import { float, mix, texture, uniformArray, uv, vec2 } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { SCREEN, WallScreens } from './display.ts'
import { InteriorWindows, ROOM } from './interior.ts'
import type { GlazingStrip } from './rooms.ts'
import { layerIndex } from './layer.ts'
import { GLOW, MATERIAL_NAME } from './pack.ts'
import { WallRelief } from './relief.ts'
import { stretchOf } from './wall.ts'

/**
 * What a wall is when the pack carries no relief for it: one coated dark
 * surface, which is what the whole city was before the strip existed and is
 * still what a headless caller with no pictures gets.
 */
export const SURFACE = { roughness: 0.68, metalness: 0 } as const

export interface PrefabAtlas {
  /** One layer per finish: the colour a face is painted. */
  readonly colour: THREE.DataArrayTexture
  /** The same layers, holding only what glows. */
  readonly emissive: THREE.DataArrayTexture
  /** Everything a window can show, one picture per layer: back walls, flat panels, and the faces a marched room shares. */
  readonly rooms: THREE.DataArrayTexture
  /** How that strip is laid out, as the pack manifest records it. */
  readonly glazing: GlazingStrip
  /** The pictures the screens on the walls carry, one per layer. */
  readonly screens: THREE.DataArrayTexture
  /**
   * The same layers again, holding normal x and y and roughness. Absent where
   * the pack carries none, and then every wall is `SURFACE`.
   */
  readonly relief?: THREE.DataArrayTexture
  /**
   * Each relief layer's mean roughness, in strip order. What a far building is
   * drawn at, since a shell reads no texture behind its wall.
   */
  readonly roughness?: readonly number[]
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
 * lets the sampler wrap it without bleeding into the picture next door. A base
 * layer is read with its v stretched, so the same picture lands at the same
 * scale on the wall above the street and on the walls a band is composed on.
 *
 * The windows are not in the picture. `InteriorWindows` cuts them out of the
 * wall arithmetically and draws what is behind each one, a flat panel on most
 * of them and a marched room on the rest, so a facade has depth through it from
 * the pavement instead of a lit rectangle; the glass over the opening is
 * `glassMaterial`, on the pane `Panes` stands in front of this wall.
 * `WallScreens` does the same for the panels: the picture and the lamp grid
 * over it are arithmetic over one fetch.
 *
 * The two never meet. A layer either has windows in it or it is a screen, so a
 * fragment pays for one of them and a wall fragment pays for neither beyond the
 * comparison that says so.
 *
 * Nothing glows in daylight. The windows, the screens and the neon are the
 * night level times what is behind the glass, so at noon a facade is a dark
 * wall with dim rooms in it and after dark it is the light in the street.
 *
 * A wall is also shaped, and that is one more fetch of the same uv: `relief`
 * gives every finish its own normal and its own roughness, so glazed tile,
 * precast concrete and weathering steel stop being one surface with three
 * photographs on it. Nothing in the pack is metal: there is no probe on a
 * street, and a metal wall with only the sky to reflect is a hole in the town.
 */
export function prefabMaterial(atlas: PrefabAtlas, night: CityNight): THREE.Material {
  const layer = layerIndex()
  const stretch = uniformArray<'float'>(atlas.finishes.map(stretchOf), 'float')
  const at = uv().mul(vec2(1, stretch.element(layer)))
  const wall = texture(atlas.colour, at).depth(layer)
  const burning = texture(atlas.emissive, at).depth(layer).rgb.mul(float(GLOW))
  const room = new InteriorWindows(atlas.rooms, atlas.glazing, night, atlas.finishes).glazing()
  const panel = new WallScreens(atlas.screens, atlas.finishes).panel()

  const surface = atlas.relief ? new WallRelief(atlas.relief).read(at, layer) : undefined
  const wallRoughness = surface?.roughness ?? float(SURFACE.roughness)

  const material = new MeshStandardNodeMaterial()
  material.name = MATERIAL_NAME
  material.colorNode = mix(mix(wall.rgb, room.light.mul(float(ROOM.albedo)), room.share), panel.light.mul(float(SCREEN.albedo)), panel.share)
  material.emissiveNode = mix(mix(burning, room.light.mul(float(ROOM.glow)), room.share), panel.light.mul(float(SCREEN.glow)), panel.share).mul(night.level)
  material.roughnessNode = mix(mix(wallRoughness, float(ROOM.roughness), room.share), float(SCREEN.roughness), panel.share)
  material.metalnessNode = float(SURFACE.metalness)
  if (surface) material.normalNode = surface.normal
  return material
}
