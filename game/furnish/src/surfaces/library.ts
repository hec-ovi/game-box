import * as THREE from 'three'
import { SURFACE_LOOKS, SURFACE_TEXTURES, type SurfaceLook, type SurfacePart, type SurfaceTextureId } from './surfaces.ts'
import { worldTiled } from './tiling.ts'

/** The maps of one tiling surface, as the pack carries them. */
export interface SurfaceMaps {
  readonly map: THREE.Texture
  readonly normal: THREE.Texture | undefined
}

/**
 * The floor, the walls and the ceiling, built once out of the pack's tiling
 * textures. Every room in town shares them: an interior is three materials, not
 * three per building.
 */
export class SurfaceLibrary {
  readonly #maps: ReadonlyMap<SurfaceTextureId, SurfaceMaps>
  readonly #materials = new Map<SurfaceLook, THREE.Material>()

  constructor(maps: ReadonlyMap<SurfaceTextureId, SurfaceMaps>) {
    this.#maps = new Map([...maps].map(([id, surface]) => [id, tiled(surface, SURFACE_TEXTURES[id].tile)]))
  }

  material(part: SurfacePart): THREE.Material {
    const look = SURFACE_LOOKS[part]
    let material = this.#materials.get(look)
    if (!material) {
      material = this.#build(look)
      this.#materials.set(look, material)
    }
    return material
  }

  dispose(): void {
    for (const material of this.#materials.values()) material.dispose()
    for (const surface of this.#maps.values()) {
      surface.map.dispose()
      surface.normal?.dispose()
    }
  }

  #build(look: SurfaceLook): THREE.Material {
    const maps = this.#maps.get(look.map)
    const material = new THREE.MeshStandardMaterial({
      name: look.name,
      color: look.colour,
      roughness: look.roughness,
      metalness: 0,
      map: maps?.map ?? null,
      normalMap: maps?.normal ?? null,
    })
    if (look.normalScale !== undefined) material.normalScale.setScalar(look.normalScale)
    return worldTiled(material)
  }
}

/** A surface set to repeat every `metres`, given the world-space UVs `tiling.ts` lays down. */
function tiled(surface: SurfaceMaps, metres: number): SurfaceMaps {
  return { map: repeating(surface.map, metres)!, normal: repeating(surface.normal, metres) }
}

/**
 * The pack's texture, tiled. It is cloned because the same image may be hanging
 * on more than one surface at different tile sizes; the clone shares the image,
 * so it costs no download and no second decode.
 */
function repeating(source: THREE.Texture | undefined, metres: number): THREE.Texture | undefined {
  if (!source) return undefined
  const texture = source.clone()
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1 / metres, 1 / metres)
  // a floor is seen at a grazing angle more than anything else in a room
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}
