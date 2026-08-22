import { existsSync } from 'node:fs'
import { BUILDING_KINDS, METRICS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { KitDressing, PIECES, PIECE_IDS, RELIEF } from '../src/index.ts'
import { KIT_FILE, loadPackedKit } from './pack.ts'
import { boundsOf, meshesOf, plotOf, sizeOf, trianglesOf } from './support.ts'

// the pack arrives with tools/fetch-assets.mjs and tools/build-kit.ts; without it there is nothing to build from
const packed = existsSync(KIT_FILE)
const kit = packed ? await loadPackedKit() : undefined
const dressing = kit ? new KitDressing(kit) : undefined

const heightOf = (storeys: number) => METRICS.building.groundFloorHeight + (storeys - 1) * METRICS.building.storeyHeight

describe.skipIf(!packed)('the shipped kit', () => {
  it('builds every kind of place out of real pieces', () => {
    for (const kind of BUILDING_KINDS) {
      const plot = plotOf({ kind, storeys: 3, rect: { x: 4, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' } })
      const building = dressing!.building(plot, sizeOf(plot, heightOf(3)))
      const meshes = meshesOf(building)

      expect(trianglesOf(building), kind).toBeGreaterThan(0)
      for (const mesh of meshes) {
        expect(mesh.geometry.getAttribute('position').count, `${kind} ${mesh.name}`).toBeGreaterThan(0)
      }
      // one draw per material on the building, not one per piece
      expect(new Set(meshes.map((mesh) => (mesh.material as THREE.Material).name)).size).toBe(meshes.length)
    }
  })

  it('builds to the size the plot asked for', () => {
    for (const [rect, storeys] of [
      [{ x: 4, y: 4, w: 2, h: 2 }, 1],
      [{ x: 10, y: 4, w: 5, h: 3 }, 4],
      [{ x: 4, y: 12, w: 1, h: 4 }, 6],
    ] as const) {
      const plot = plotOf({ kind: 'shop', storeys, rect, entrance: { cell: { x: rect.x, y: rect.y + rect.h }, facing: 'south' } })
      const size = sizeOf(plot, heightOf(storeys))
      const bounds = boundsOf(dressing!.building(plot, size))
      const measured = bounds.getSize(new THREE.Vector3())

      expect(measured.x).toBeGreaterThanOrEqual(size.width - 1e-3)
      expect(measured.x).toBeLessThanOrEqual(size.width + 2 * RELIEF)
      expect(measured.z).toBeGreaterThanOrEqual(size.depth - 1e-3)
      expect(measured.z).toBeLessThanOrEqual(size.depth + 2 * RELIEF)
      expect(bounds.max.y).toBeCloseTo(size.height, 2)
      expect(bounds.min.y).toBeCloseTo(0, 2)
    }
  })

  it('holds every piece at the bounds the catalog measured', () => {
    for (const id of PIECE_IDS) {
      const bounds = new THREE.Box3()
      for (const part of kit!.parts(id)) {
        part.geometry.computeBoundingBox()
        bounds.union(part.geometry.boundingBox!)
      }
      for (const axis of [0, 1, 2] as const) {
        expect(bounds.min.getComponent(axis), `${id} min ${'xyz'[axis]}`).toBeCloseTo(PIECES[id].min[axis], 2)
        expect(bounds.max.getComponent(axis), `${id} max ${'xyz'[axis]}`).toBeCloseTo(PIECES[id].max[axis], 2)
      }
    }
  })
})
