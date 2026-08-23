import * as THREE from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import type { FurnishStyle } from '../style/palette.ts'
import { SURFACE_LOOKS, SURFACE_TEXTURES, type SurfaceLook, type SurfacePart, type SurfaceTextureId } from './surfaces.ts'
import { MetreTiling } from './tiling.ts'

/** The maps of one tiling surface, as the pack carries them. */
export interface SurfaceMaps {
  readonly map: THREE.Texture
  readonly normal: THREE.Texture | undefined
}

/**
 * The floor, the walls and the ceiling, built once out of the pack's tiling
 * images, in each of the two interior languages. Every room in town shares
 * them: an interior is three materials, not three per building, and the two
 * languages read off the same two images. Each one carries the density its
 * image is drawn at, so the size of the room it lands in makes no difference to
 * the size of the stones in it.
 */
export class SurfaceLibrary {
  readonly #maps: ReadonlyMap<SurfaceTextureId, SurfaceMaps>
  readonly #materials = new Map<SurfaceLook, THREE.Material>()

  constructor(maps: ReadonlyMap<SurfaceTextureId, SurfaceMaps>) {
    for (const surface of maps.values()) {
      repeating(surface.map)
      repeating(surface.normal)
    }
    this.#maps = maps
  }

  material(part: SurfacePart, style: FurnishStyle): THREE.Material {
    const look = SURFACE_LOOKS[style][part]
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
    const material = new MeshStandardNodeMaterial({
      name: look.name,
      color: look.colour,
      roughness: look.roughness,
      metalness: 0,
      map: maps?.map ?? null,
      normalMap: maps?.normal ?? null,
    })
    if (look.normalScale !== undefined) material.normalScale.setScalar(look.normalScale)
    return new MetreTiling(SURFACE_TEXTURES[look.map].metres).apply(material)
  }
}

/** A tile that cannot repeat is one tile and a smear, whatever the pack's own sampler says. */
function repeating(texture: THREE.Texture | undefined): void {
  if (!texture) return
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  // a floor is seen at a grazing angle more than anything else in a room
  texture.anisotropy = 8
  texture.needsUpdate = true
}
