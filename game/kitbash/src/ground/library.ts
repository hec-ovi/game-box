import type { CellKind } from '@gb/world'
import * as THREE from 'three'
import { GROUND_LOOKS, GROUND_TEXTURES, type GroundLook, type GroundTextureId } from './surfaces.ts'

/** The maps of one tiling surface, as the pack carries them. */
export interface GroundMaps {
  readonly map: THREE.Texture | undefined
  readonly normal: THREE.Texture | undefined
}

/**
 * The surfaces the city floor is made of, built once out of the pack's tiling
 * textures. A kind of cell is always the same material instance, because a
 * city has thousands of cells and a handful of surfaces.
 */
export class GroundLibrary {
  readonly #maps: ReadonlyMap<GroundTextureId, GroundMaps>
  readonly #materials = new Map<GroundLook, THREE.Material>()

  constructor(maps: ReadonlyMap<GroundTextureId, GroundMaps>) {
    this.#maps = new Map([...maps].map(([id, surface]) => [id, tiled(surface, GROUND_TEXTURES[id].tile)]))
  }

  /** The surface of one kind of cell. */
  material(kind: CellKind): THREE.Material {
    const look = GROUND_LOOKS[kind]
    let material = this.#materials.get(look)
    if (!material) {
      material = this.#build(look)
      this.#materials.set(look, material)
    }
    return material
  }

  /** Frees every material and texture the library holds. */
  dispose(): void {
    for (const material of this.#materials.values()) material.dispose()
    for (const surface of this.#maps.values()) {
      surface.map?.dispose()
      surface.normal?.dispose()
    }
  }

  #build(look: GroundLook): THREE.Material {
    const material = new THREE.MeshStandardMaterial({
      name: look.name,
      color: look.colour,
      roughness: look.roughness,
      metalness: 0,
      map: (look.map && this.#maps.get(look.map)?.map) ?? null,
      normalMap: (look.normal && this.#maps.get(look.normal)?.normal) ?? null,
    })
    if (look.normalScale !== undefined) material.normalScale.setScalar(look.normalScale)
    return material
  }
}

/** A surface set to repeat every `metres`, given ground UVs measured in metres. */
function tiled(surface: GroundMaps, metres: number): GroundMaps {
  return { map: repeating(surface.map, metres), normal: repeating(surface.normal, metres) }
}

/**
 * The pack's texture, tiled. It is cloned first because the kit's own road
 * piece is painted with the same image, and how the ground tiles is not how a
 * building does. The clone shares the image, so it costs no download and no
 * second decode.
 */
function repeating(source: THREE.Texture | undefined, metres: number): THREE.Texture | undefined {
  if (!source) return undefined
  const texture = source.clone()
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1 / metres, 1 / metres)
  // ground is seen at a grazing angle more than anything else in the city
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}
