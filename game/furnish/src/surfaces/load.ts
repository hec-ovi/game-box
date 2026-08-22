import * as THREE from 'three'
import { SurfaceLibrary, type SurfaceMaps } from './library.ts'
import { SURFACE_TEXTURES, SURFACE_TEXTURE_IDS, type SurfaceTextureId } from './surfaces.ts'

/**
 * Picks the tiling interior surfaces out of a loaded pack. Each one rides on a
 * node of its own, a quad carrying nothing but the material its maps hang on.
 *
 * A pack missing any of them gives none of them, and `surface` falls through to
 * the dressing behind: a room with a real floor and flat-colour walls looks
 * worse than a room of flat colours.
 */
export function loadSurfaces(roots: readonly THREE.Object3D[]): SurfaceLibrary | undefined {
  const maps = new Map<SurfaceTextureId, SurfaceMaps>()

  for (const id of SURFACE_TEXTURE_IDS) {
    const found = mapsOf(roots, SURFACE_TEXTURES[id].node)
    if (!found) return undefined
    maps.set(id, found)
  }
  return new SurfaceLibrary(maps)
}

/** The maps on the first drawable thing under a node. */
function mapsOf(roots: readonly THREE.Object3D[], node: string): SurfaceMaps | undefined {
  for (const root of roots) {
    const object = root.getObjectByName(node)
    if (!object) continue

    let found: SurfaceMaps | undefined
    object.traverse((child) => {
      if (found || !(child instanceof THREE.Mesh)) return
      const material = Array.isArray(child.material) ? child.material[0]! : child.material
      if (material instanceof THREE.MeshStandardMaterial && material.map) {
        found = { map: material.map, normal: material.normalMap ?? undefined }
      }
    })
    if (found) return found
  }
  return undefined
}
