import { existsSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FURNISH_STYLES, FurnishDressing, SURFACE_PARTS, SURFACE_TEXTURES, lookOf, mapsOf, tilingOf } from '../src/index.ts'
import { KIT_FILE, loadPackedFurnish } from './pack.ts'
import { ROOM_SIZE } from './support.ts'

// the pack arrives with tools/build-kit.ts; without it there is nothing to check
const packed = existsSync(KIT_FILE)
const kit = packed ? await loadPackedFurnish() : undefined

describe.skipIf(!packed)('the shipped pack', () => {
  it('carries a floor, walls and a ceiling that tile at the size the table says', () => {
    for (const style of FURNISH_STYLES) {
      const dressing = new FurnishDressing(kit!, undefined, style)
      for (const part of SURFACE_PARTS) {
        const material = dressing.surface(part, ROOM_SIZE) as THREE.MeshStandardMaterial
        const look = lookOf(style, part)

        expect(material.name, `${style} ${part}`).toBe(look.name)
        expect(mapsOf(material)?.map, `${style} ${part}`).toBeInstanceOf(THREE.Texture)
        expect(tilingOf(material)?.metres, `${style} ${part}`).toBe(SURFACE_TEXTURES[look.map].metres)
      }
    }
  })

  it('shares one material per surface across the whole town', () => {
    const dressing = new FurnishDressing(kit!)
    for (const part of SURFACE_PARTS) expect(dressing.surface(part, ROOM_SIZE)).toBe(dressing.surface(part, ROOM_SIZE))
  })
})
