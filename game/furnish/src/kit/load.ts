import * as THREE from 'three'
import { PIECE_IDS, type PieceId } from '../catalog/pieces.ts'
import { loadSurfaces } from '../surfaces/load.ts'
import { buildProps, type Part } from './build.ts'
import { FurnishIncomplete } from './error.ts'
import { canonical } from './geometry.ts'
import { FurnishLibrary } from './library.ts'

/**
 * Indexes a loaded pack: hand it the scene of the packed glTF and it picks out
 * every model the catalog names, by node name, in the units the artist drew it
 * in, then builds the furniture out of them.
 *
 * Materials are shared by name, so a whole town of rooms draws with the two the
 * kits actually have. The tiling floor and wall surfaces come out of the same
 * scene, when the pack carries them.
 */
export function loadFurnish(scenes: THREE.Object3D | readonly THREE.Object3D[]): FurnishLibrary {
  const roots = Array.isArray(scenes) ? scenes : [scenes as THREE.Object3D]
  for (const root of roots) root.updateMatrixWorld(true)

  const pieces = new Map<PieceId, Part[]>()
  const materials = new Map<string, THREE.Material>()
  const missing: PieceId[] = []

  for (const id of PIECE_IDS) {
    const node = find(roots, id)
    const found: Part[] = []
    node?.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      // a mesh with no vertices is not a part: it would only make an empty draw
      if (!child.geometry.getAttribute('position')?.count) return
      const material = Array.isArray(child.material) ? child.material[0]! : child.material
      if (!materials.has(material.name)) materials.set(material.name, material)
      found.push({ material: material.name, geometry: canonical(child.geometry).applyMatrix4(child.matrixWorld) })
    })
    if (found.length) pieces.set(id, found)
    else missing.push(id)
  }
  if (missing.length) throw new FurnishIncomplete(missing)

  const props = buildProps(pieces)
  for (const parts of pieces.values()) for (const part of parts) part.geometry.dispose()
  return new FurnishLibrary(props, materials, loadSurfaces(roots))
}

function find(roots: readonly THREE.Object3D[], name: string): THREE.Object3D | undefined {
  for (const root of roots) {
    const found = root.getObjectByName(name)
    if (found) return found
  }
  return undefined
}
