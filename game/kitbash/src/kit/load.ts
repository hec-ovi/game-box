import * as THREE from 'three'
import { nodeNamesOf, PIECE_IDS, type PieceId } from '../catalog/pieces.ts'
import { KitIncomplete } from './error.ts'
import { KitLibrary, type KitPart } from './library.ts'

/**
 * Indexes a loaded kit: hand it the scene of the packed glTF and it picks out
 * every piece the catalog names, by node name, in the piece's own frame.
 * Materials are shared by name across pieces, so the whole city ends up
 * drawing with the handful the kit actually has.
 */
export function loadKit(scenes: THREE.Object3D | readonly THREE.Object3D[]): KitLibrary {
  const roots = Array.isArray(scenes) ? scenes : [scenes as THREE.Object3D]
  for (const root of roots) root.updateMatrixWorld(true)
  const parts = new Map<PieceId, KitPart[]>()
  const materials = new Map<string, THREE.Material>()
  const toPiece = new THREE.Matrix4()

  for (const id of PIECE_IDS) {
    const node = find(roots, nodeNamesOf(id))
    if (!node) continue
    toPiece.copy(node.matrixWorld).invert()
    const found: KitPart[] = []
    node.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if (!materials.has(material.name)) materials.set(material.name, material)
      }
      const geometry = trimmed(child.geometry)
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toPiece, child.matrixWorld))
      const material = Array.isArray(child.material) ? child.material[0]! : child.material
      found.push({ material: material.name, geometry })
    })
    if (found.length) parts.set(id, found)
  }

  const missing = KitLibrary.missing(parts)
  if (missing.length) throw new KitIncomplete(missing)
  return new KitLibrary(parts, materials)
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

/**
 * A copy carrying only what merging needs. Kit exports also ship a second UV
 * set and vertex colours, and geometries have to agree attribute for attribute
 * before they can be merged.
 */
function trimmed(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  const position = source.getAttribute('position')
  geometry.setAttribute('position', position.clone())
  geometry.setAttribute('normal', (source.getAttribute('normal') ?? zeros(position.count, 3)).clone())
  geometry.setAttribute('uv', (source.getAttribute('uv') ?? zeros(position.count, 2)).clone())
  const index = source.getIndex()
  geometry.setIndex(index ? index.clone() : sequence(position.count))
  return geometry
}

function zeros(count: number, size: number): THREE.BufferAttribute {
  return new THREE.BufferAttribute(new Float32Array(count * size), size)
}

function sequence(count: number): THREE.BufferAttribute {
  const array = new Uint32Array(count)
  for (let i = 0; i < count; i++) array[i] = i
  return new THREE.BufferAttribute(array, 1)
}
