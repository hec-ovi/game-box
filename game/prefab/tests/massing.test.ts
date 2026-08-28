import { KitDressing, placeholderKit } from '@gb/kitbash'
import { Greybox, storeyHeight } from '@gb/scene'
import { PLOT_BAND, TALLEST_STOREYS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PrefabDressing } from '../src/dressing.ts'
import { SHELL_MATERIAL_NAME } from '../src/pack.ts'
import { catalogueOf, charterOf, libraryOf, plotOf } from './support.ts'

/**
 * What a plot the pack has no model for is drawn as from far off.
 *
 * Measured on the metro 20 by 20 city: 714 of its 3,489 plots are outside the
 * plot band, the dressing behind draws them as a stack of kit pieces, and that
 * stack is 7,439 triangles and 2.98 ms for a shell nobody is nearer than the
 * detail radius to. From that far a building is a silhouette with lit windows,
 * and the shell material draws both over a box for nothing.
 */

const catalogue = catalogueOf()
const behind = () => new KitDressing(placeholderKit('a neon city'), new Greybox())

/** The one mesh a shell is, and what it is made of. */
function shellOf(storeys: number): THREE.Mesh {
  const plot = plotOf({ kind: 'office', storeys })
  const size = { width: 8, depth: 12, height: storeyHeight(storeys) }
  const drawn = new PrefabDressing(libraryOf(catalogue), behind()).shell(plot, size, charterOf(plot))
  const meshes: THREE.Mesh[] = []
  drawn.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh)
  })
  expect(meshes.length, 'a massing is one mesh').toBe(1)
  return meshes[0]!
}

/** Every attribute the geometry carries, as the batcher reads it: a shell only shares a buffer with one that agrees. */
function shape(geometry: THREE.BufferGeometry): string {
  const attributes = Object.keys(geometry.attributes)
    .sort()
    .map((name) => `${name}:${geometry.getAttribute(name).itemSize}`)
  return `${attributes.join(',')}|${geometry.getIndex() ? 'indexed' : 'none'}`
}

/** Which layers of the pack's strip the box is painted with, in order. */
function layers(geometry: THREE.BufferGeometry): number[] {
  const attribute = geometry.getAttribute('_layer')
  return Array.from({ length: attribute.count }, (_, at) => Math.round(attribute.getX(at)))
}

function triangles(geometry: THREE.BufferGeometry): number {
  return (geometry.getIndex()?.count ?? geometry.getAttribute('position').count) / 3
}

describe('a plot the pack has no model for', () => {
  it('wears its massing on the shell material, at the size the plot stands', () => {
    for (const storeys of [PLOT_BAND.storeys.max + 1, 24, TALLEST_STOREYS]) {
      const mesh = shellOf(storeys)
      expect((mesh.material as THREE.Material).name, `${storeys} storeys`).toBe(SHELL_MATERIAL_NAME)

      const box = new THREE.Box3().setFromObject(mesh)
      expect(box.min.y, `${storeys} storeys`).toBeCloseTo(0)
      expect(box.max.y, `${storeys} storeys`).toBeCloseTo(storeyHeight(storeys))
      expect(box.max.x - box.min.x, `${storeys} storeys`).toBeCloseTo(8)
      expect(box.max.z - box.min.z, `${storeys} storeys`).toBeCloseTo(12)
    }
  })

  it('costs a box rather than a stack of the dressing behind, however tall the plot is', () => {
    const plot = plotOf({ kind: 'office', storeys: 24 })
    const size = { width: 8, depth: 12, height: storeyHeight(24) }
    const kit = behind().shell(plot, size, charterOf(plot))
    let stacked = 0
    kit.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh) stacked += triangles(mesh.geometry)
    })

    const drawn = triangles(shellOf(24).geometry)
    expect(drawn).toBeLessThan(64)
    expect(drawn, `the massing is ${drawn} triangles against the kit's ${stacked}`).toBeLessThan(stacked / 10)
  })

  it('agrees attribute for attribute with a shell out of the pack, so both are one buffer and one draw', () => {
    const dressing = new PrefabDressing(libraryOf(catalogue), behind())
    const covered = plotOf()
    const packed = dressing.shell(covered, { width: 8, depth: 12, height: storeyHeight(2) }, charterOf(covered))
    const pack = (packed.children[0] as THREE.Mesh).geometry

    expect(shape(shellOf(24).geometry)).toBe(shape(pack))
  })

  it('draws the same box for the same plot, and hands the whole building to the dressing behind up close', () => {
    // the look a plot with no model wears is picked off its own id, so a
    // second dressing of the same city has to paint it the same
    expect(layers(shellOf(24).geometry)).toEqual(layers(shellOf(24).geometry))

    const plot = plotOf({ kind: 'office', storeys: 24 })
    const size = { width: 8, depth: 12, height: storeyHeight(24) }
    const building = new PrefabDressing(libraryOf(catalogue), behind()).building(plot, size, charterOf(plot))
    let meshes = 0
    building.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshes++
    })
    // the dressing behind stacks a tower out of many pieces; a massing is one
    expect(meshes, 'the building up close is still the dressing behind').toBeGreaterThan(1)
  })
})
