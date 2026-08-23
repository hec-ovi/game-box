import * as THREE from 'three'
import { FURNITURE_IDS, type FurnitureId } from '../catalog/furniture.ts'
import { nodeNamesOf, PIECE_IDS, type PieceId } from '../catalog/pieces.ts'
import { loadGround } from '../ground/load.ts'
import { flavourOf } from '../look/flavour.ts'
import { KitIncomplete } from './error.ts'
import { canonical } from './geometry.ts'
import { DEFAULT_THEME, KitLibrary, type KitPart } from './library.ts'

/**
 * Indexes a loaded kit: hand it the scene of the packed glTF and it picks out
 * every piece the catalog names, by node name, in metres.
 *
 * A piece comes out in the frame it was authored in: 2 m across x, base on
 * y = 0, outer face on z = 0. That is the pack's own frame, because the pack
 * builder merges the piece files without moving them, so the transform above a
 * piece is its dequantization and gets baked into the geometry. Every geometry
 * is brought to one shape on the way through, so any two of them weld.
 *
 * Materials are shared by name across pieces, so the whole city ends up drawing
 * with the handful the kit actually has, and each of them is taken to the tone
 * the theme asks for: a neon city is near black, a farming village is not. The
 * pack's tiling ground surfaces and its street furniture come out of the same
 * scene, when it has them, and the ground answers to the same theme: the wall
 * pieces are the only ones a kit has to carry.
 */
export function loadKit(scenes: THREE.Object3D | readonly THREE.Object3D[], theme = DEFAULT_THEME): KitLibrary {
  const roots = Array.isArray(scenes) ? scenes : [scenes as THREE.Object3D]
  for (const root of roots) root.updateMatrixWorld(true)
  const parts = new Map<PieceId | FurnitureId, KitPart[]>()
  const materials = new Map<string, THREE.Material>()

  for (const id of [...PIECE_IDS, ...FURNITURE_IDS]) {
    const node = find(roots, nodeNamesOf(id))
    if (!node) continue
    const found: KitPart[] = []
    node.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      // a mesh with no vertices is not a part: it would only make an empty draw
      if (!child.geometry.getAttribute('position')?.count) return
      const material = Array.isArray(child.material) ? child.material[0]! : child.material
      if (!materials.has(material.name)) materials.set(material.name, material)
      found.push({ material: material.name, geometry: canonical(child.geometry).applyMatrix4(child.matrixWorld) })
    })
    if (found.length) parts.set(id, found)
  }

  const missing = KitLibrary.missing(parts)
  if (missing.length) throw new KitIncomplete(missing)
  return new KitLibrary(parts, materials, loadGround(roots, flavourOf(theme)), theme)
}

function find(roots: readonly THREE.Object3D[], names: readonly string[]): THREE.Object3D | undefined {
  for (const name of names) {
    for (const root of roots) {
      const found = root.getObjectByName(name)
      if (found) return found
    }
  }
  return undefined
}
