import * as THREE from 'three'
import { PIECE_IDS, type PieceId } from '../catalog/pieces.ts'
import { buildProps, type Part } from './build.ts'
import { canonical } from './geometry.ts'
import { FurnishLibrary } from './library.ts'

/**
 * The catalog with a block standing in for every model: the same fitting, the
 * same footprints, no art. It is what the tests build with, and it carries no
 * surfaces, so a room built on it still asks the dressing behind for its floor
 * and walls.
 */
export function placeholderFurnish(): FurnishLibrary {
  const material = new THREE.MeshStandardMaterial({ name: 'placeholder', color: 0x7d7468, roughness: 0.9 })
  const pieces = new Map<PieceId, Part[]>()

  for (const id of PIECE_IDS) {
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    // the same shape a loaded pack is brought to, so both fit and weld the same way
    const geometry = canonical(box)
    box.dispose()
    pieces.set(id, [{ material: material.name, geometry }])
  }

  const props = buildProps(pieces)
  for (const parts of pieces.values()) for (const part of parts) part.geometry.dispose()
  return new FurnishLibrary(props, new Map([[material.name, material]]))
}
