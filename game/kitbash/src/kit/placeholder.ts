import * as THREE from 'three'
import { PIECES, PIECE_IDS, type PieceId } from '../catalog/pieces.ts'
import { KitLibrary, type KitPart } from './library.ts'

/** Roughly what each kit material looks like, so a kitless city still reads as a street. */
const COLOURS: Record<string, number> = {
  MI_RedBrick: 0x8c4a3a,
  MI_RedBrick_Pale: 0xa8776a,
  MI_Trim: 0xa9a49a,
  MI_Trim_Dark: 0x3a3a3c,
  MI_Trim_Green: 0x3f5f4a,
  MI_Trim_MetalConcrete: 0x9a9a96,
  MI_InteriorWall: 0x6a6560,
  MI_FakeInterior: 0x2a2724,
  MI_Glass: 0x35505c,
  MI_Asphalt: 0x3a3a3e,
}

/**
 * The catalog as plain boxes at the measured sizes. It is what the tests build
 * with, and what a building falls back to if the packed kit has not loaded:
 * the same composition, the same footprint, no art.
 */
export function placeholderKit(): KitLibrary {
  const parts = new Map<PieceId, KitPart[]>()
  const materials = new Map<string, THREE.Material>()

  for (const id of PIECE_IDS) {
    const { min, max, materials: names } = PIECES[id]
    parts.set(id, names.map((name): KitPart => {
      if (!materials.has(name)) {
        materials.set(name, new THREE.MeshStandardMaterial({ name, color: COLOURS[name] ?? 0x8a8a8a }))
      }
      const geometry = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])
      geometry.clearGroups()
      geometry.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2)
      return { material: name, geometry }
    }))
  }
  return new KitLibrary(parts, materials)
}
