import * as THREE from 'three'
import { FURNITURE, FURNITURE_IDS, LAMP_LENS, LAMP_POST, type FurnitureId } from '../catalog/furniture.ts'
import { PIECES, PIECE_IDS, type PieceId } from '../catalog/pieces.ts'
import { canonical } from './geometry.ts'
import { DEFAULT_THEME, KitLibrary, type KitPart } from './library.ts'

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
  [LAMP_POST]: 0x24352a,
  [LAMP_LENS]: 0xffb84a,
}

/** How much of a lamp's height the lantern takes, in the stand-in. */
const LANTERN = 0.55

/**
 * The catalog as plain boxes at the measured sizes. It is what the tests build
 * with, and what a building falls back to if the packed kit has not loaded:
 * the same composition, the same footprint, no art.
 */
export function placeholderKit(theme = DEFAULT_THEME): KitLibrary {
  const parts = new Map<PieceId | FurnitureId, KitPart[]>()
  const materials = new Map<string, THREE.Material>()
  const material = (name: string): THREE.Material => {
    let found = materials.get(name)
    if (!found) {
      found = new THREE.MeshStandardMaterial({ name, color: COLOURS[name] ?? 0x8a8a8a })
      materials.set(name, found)
    }
    return found
  }

  for (const id of PIECE_IDS) {
    parts.set(id, PIECES[id].materials.map((name) => {
      material(name)
      return { material: name, geometry: boxOf(PIECES[id]) }
    }))
  }
  // the lamp stands in as a post with a lantern on top of it, so the stand-in
  // glows at the height the real one does
  for (const id of FURNITURE_IDS) {
    const { min, max } = FURNITURE[id]
    const [shaft, sill] = [max[0] * 0.35, max[1] - LANTERN]
    parts.set(id, [
      { material: LAMP_POST, geometry: boxOf({ min: [-shaft, 0, -shaft], max: [shaft, sill, shaft] }) },
      { material: LAMP_LENS, geometry: boxOf({ min: [min[0], sill, min[2]], max: [max[0], max[1], max[2]] }) },
    ])
    material(LAMP_POST)
    material(LAMP_LENS)
  }

  return new KitLibrary(parts, materials, undefined, theme)
}

/** The piece's bounds as a plain box, in the shape a loaded kit is brought to. */
function boxOf({ min, max }: { min: readonly [number, number, number]; max: readonly [number, number, number] }): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])
  box.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2)
  const geometry = canonical(box)
  box.dispose()
  return geometry
}
