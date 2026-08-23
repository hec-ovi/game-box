import * as THREE from 'three'
import type { Flavour } from '../look/flavour.ts'
import { GroundLibrary, type GroundMaps } from './library.ts'
import { GROUND_TEXTURES, GROUND_TEXTURE_IDS, type GroundTextureId } from './surfaces.ts'

/**
 * Picks the tiling ground surfaces out of a loaded pack, at the value the kind
 * of town asks for. Each one rides on a node of its own, a quad carrying
 * nothing but the material its maps hang on.
 *
 * A pack that does not have all of them gives nothing back, and the dressing
 * falls through to whatever is behind it: half a street textured and half of
 * it flat is worse than the greybox.
 */
export function loadGround(roots: readonly THREE.Object3D[], flavour: Flavour): GroundLibrary | undefined {
  const maps = new Map<GroundTextureId, GroundMaps>()

  for (const id of GROUND_TEXTURE_IDS) {
    const surface = GROUND_TEXTURES[id]
    const found = mapsOf(roots, surface.node)
    if (!found?.map) return undefined
    if (surface.relief && !found.normal) return undefined
    maps.set(id, found)
  }
  return new GroundLibrary(maps, flavour)
}

/** The maps on the first drawable thing under a node. */
function mapsOf(roots: readonly THREE.Object3D[], node: string): GroundMaps | undefined {
  for (const root of roots) {
    const object = root.getObjectByName(node)
    if (!object) continue

    let found: GroundMaps | undefined
    object.traverse((child) => {
      if (found || !(child instanceof THREE.Mesh)) return
      const material = Array.isArray(child.material) ? child.material[0]! : child.material
      if (material instanceof THREE.MeshStandardMaterial) {
        found = { map: material.map ?? undefined, normal: material.normalMap ?? undefined }
      }
    })
    if (found) return found
  }
  return undefined
}
