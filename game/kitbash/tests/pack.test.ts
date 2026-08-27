import { existsSync } from 'node:fs'
import { METRICS, SHIPPED_CHARTERS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { KitDressing, PIECES, PIECE_IDS, RELIEF, type PieceId } from '../src/index.ts'
import { KIT_FILE, loadPackedKit } from './pack.ts'
import { charterOf, meshesOf, plotOf, sizeOf, trianglesOf, wallBounds } from './support.ts'

// the pack arrives with tools/fetch-assets.mjs and tools/build-kit.ts; without it there is nothing to build from
const packed = existsSync(KIT_FILE)
const kit = packed ? await loadPackedKit() : undefined
const dressing = kit ? new KitDressing(kit) : undefined

const heightOf = (storeys: number) => METRICS.building.groundFloorHeight + (storeys - 1) * METRICS.building.storeyHeight

describe.skipIf(!packed)('the shipped kit', () => {
  it('builds every kind of place out of real pieces', () => {
    for (const charter of SHIPPED_CHARTERS) {
      const kind = charter.word
      const plot = plotOf({ kind, storeys: 3, rect: { x: 4, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' } })
      const building = dressing!.building(plot, sizeOf(plot, heightOf(3)), charter)
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
      const bounds = wallBounds(dressing!.building(plot, size, charterOf(plot)))
      const measured = bounds.getSize(new THREE.Vector3())

      expect(measured.x).toBeGreaterThanOrEqual(size.width - 1e-3)
      expect(measured.x).toBeLessThanOrEqual(size.width + 2 * RELIEF)
      expect(measured.z).toBeGreaterThanOrEqual(size.depth - 1e-3)
      expect(measured.z).toBeLessThanOrEqual(size.depth + 2 * RELIEF)
      expect(bounds.max.y).toBeCloseTo(size.height, 2)
      expect(bounds.min.y).toBeCloseTo(0, 2)
    }
  })

  it('carries the tiling surfaces the ground is made of', () => {
    expect(kit!.ground, 'the pack has no ground surfaces in it').toBeDefined()

    const road = dressing!.ground('street') as THREE.MeshStandardMaterial
    const pavement = dressing!.ground('sidewalk') as THREE.MeshStandardMaterial
    const park = dressing!.ground('park') as THREE.MeshStandardMaterial

    for (const material of [road, pavement, park]) {
      expect(material.map, material.name).toBeInstanceOf(THREE.Texture)
      // colour is authored in sRGB and relief is not: swapped slots wash a surface out
      expect(material.map!.colorSpace, material.name).toBe(THREE.SRGBColorSpace)
    }
    for (const material of [road, pavement]) {
      expect(material.normalMap, material.name).toBeInstanceOf(THREE.Texture)
      expect(material.normalMap!.colorSpace, material.name).toBe(THREE.NoColorSpace)
    }
  })

  it('holds every piece at the bounds the catalog measured', () => {
    const measured = (id: PieceId): THREE.Box3 => {
      const bounds = new THREE.Box3()
      for (const part of kit!.parts(id)) {
        part.geometry.computeBoundingBox()
        bounds.union(part.geometry.boundingBox!)
      }
      return bounds
    }

    for (const id of PIECE_IDS) {
      const bounds = measured(id)
      for (const axis of [0, 1, 2] as const) {
        expect(bounds.min.getComponent(axis), `${id} min ${'xyz'[axis]}`).toBeCloseTo(PIECES[id].min[axis], 2)
        expect(bounds.max.getComponent(axis), `${id} max ${'xyz'[axis]}`).toBeCloseTo(PIECES[id].max[axis], 2)
      }
    }
  })
})

describe.skipIf(!packed)('a tower on the shipped kit', () => {
  const rect = { x: 6, y: 6, w: 5, h: 4 }
  const doorstep = { cell: { x: rect.x + 2, y: rect.y - 1 }, facing: 'north' as const }

  it('carries its wall from the shopfront to the parapet with no slit in it', () => {
    for (const charter of SHIPPED_CHARTERS) {
      const plot = plotOf({ kind: charter.word, storeys: 20, rect, entrance: doorstep }, charter)
      const size = sizeOf(plot, heightOf(20))
      const shell = dressing!.shell(plot, size, charter)
      // the storeys over the shopfront are one course stretched across the
      // wall, so a course that did not reach its own ceiling would leave a
      // slit you could see the sky through from across the town
      for (const [plane, axis] of [[-size.depth / 2, 'z'], [size.width / 2, 'x']] as const) {
        const runs = wallRuns(shell, plane, axis)
        const unbroken = runs.find(([bottom, top]) => bottom <= METRICS.building.groundFloorHeight + 1e-3 && top >= size.height - 1e-3)
        expect(unbroken, `${charter.word}: the ${axis} wall runs ${JSON.stringify(runs)}`).toBeDefined()
      }
    }
  })

  it('lays the kit\'s own texture once a module across it, however wide the wall', () => {
    for (const modules of [2, 5]) {
      const square = { x: 6, y: 6, w: modules, h: modules }
      const plot = plotOf({ kind: 'house', storeys: 20, rect: square, entrance: { cell: { x: square.x, y: square.y - 1 }, facing: 'north' } })
      const size = sizeOf(plot, heightOf(20))
      const brick = meshesOf(dressing!.shell(plot, size, charterOf(plot))).find((mesh) => (mesh.material as THREE.Material).name === 'MI_RedBrick')!
      const uv = brick.geometry.getAttribute('uv')
      let [from, to] = [Infinity, -Infinity]
      for (let vertex = 0; vertex < uv.count; vertex++) [from, to] = [Math.min(from, uv.getX(vertex)), Math.max(to, uv.getX(vertex))]
      // the kit maps one module 0 to 1 across, so a wall of N modules runs N
      expect(to - from, `${modules} modules across`).toBeCloseTo(modules, 3)
    }
  })
})

/** The runs of wall, bottom to top, that stand in one wall plane: a gap between two of them is a slit. */
function wallRuns(object: THREE.Object3D, plane: number, axis: 'x' | 'z'): Array<[number, number]> {
  const runs: Array<[number, number]> = []
  for (const mesh of meshesOf(object)) {
    if ((mesh.material as THREE.Material).name.includes('Glass')) continue
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()!
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const corners = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)]
      const across = (vertex: number) => (axis === 'x' ? position.getX(vertex) : position.getZ(vertex))
      if (!corners.every((vertex) => Math.abs(across(vertex) - plane) < 3e-3)) continue
      runs.push([Math.min(...corners.map((vertex) => position.getY(vertex))), Math.max(...corners.map((vertex) => position.getY(vertex)))])
    }
  }
  runs.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const run of runs) {
    const last = merged.at(-1)
    if (last && run[0] <= last[1] + 1e-4) last[1] = Math.max(last[1], run[1])
    else merged.push([...run])
  }
  return merged
}
