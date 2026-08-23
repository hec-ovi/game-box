import type * as THREE from 'three'
import { loadSurfaces } from '../surfaces/load.ts'
import { FurnishLibrary } from './library.ts'

/** The seed a town furnishes from when the caller does not name one. */
export const DEFAULT_SEED = 'furnish'

/**
 * The furniture for a town, plus the tiling floor, wall and ceiling out of the
 * pack the app loads.
 *
 * The furniture itself is generated from the seed, so this call reads nothing
 * out of the scene but the two interior surface images. A pack with neither of
 * them gives no surfaces at all and `surface` falls through to the dressing
 * behind, because a real floor under flat-colour walls looks worse than flat
 * colour throughout.
 */
export function loadFurnish(scenes: THREE.Object3D | readonly THREE.Object3D[], seed = DEFAULT_SEED): FurnishLibrary {
  const roots = Array.isArray(scenes) ? scenes : [scenes as THREE.Object3D]
  for (const root of roots) root.updateMatrixWorld(true)
  return new FurnishLibrary(seed, loadSurfaces(roots))
}

/** The same furniture with no pack behind it: rooms keep the dressing's own floor and walls. */
export function furnishKit(seed = DEFAULT_SEED): FurnishLibrary {
  return new FurnishLibrary(seed)
}
