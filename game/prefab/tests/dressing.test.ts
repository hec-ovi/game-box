import { KitDressing, SIGN, placeholderKit } from '@gb/kitbash'
import { Greybox, buildCity } from '@gb/scene'
import { World } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PrefabDressing } from '../src/dressing.ts'
import { PROUD } from '../src/fit.ts'
import { catalogueOf, libraryOf, plotOf } from './support.ts'

const catalogue = catalogueOf()
const dressing = new PrefabDressing(libraryOf(catalogue), new Greybox())

/** Where the door plate ended up, in the building's own frame. */
function doorAt(object: THREE.Object3D): THREE.Vector3 {
  const mesh = object.children[0] as THREE.Mesh
  const box = new THREE.Box3()
  const point = new THREE.Vector3()
  const position = mesh.geometry.getAttribute('position')
  const layer = mesh.geometry.getAttribute('_layer')
  for (let i = 0; i < position.count; i++) if (layer.getX(i) === 1) box.expandByPoint(point.fromBufferAttribute(position as THREE.BufferAttribute, i))
  return box.getCenter(new THREE.Vector3())
}

describe('dressing a plot', () => {
  it('puts the door on the wall the entrance is on, at all four points of the compass', () => {
    const north = doorAt(dressing.building(plotOf({ entrance: { cell: { x: 6, y: 3 }, facing: 'north' } }), { width: 8, depth: 12, height: 7.2 }))
    const south = doorAt(dressing.building(plotOf({ entrance: { cell: { x: 6, y: 10 }, facing: 'south' } }), { width: 8, depth: 12, height: 7.2 }))
    const west = doorAt(dressing.building(plotOf({ entrance: { cell: { x: 3, y: 6 }, facing: 'west' } }), { width: 12, depth: 8, height: 7.2 }))
    const east = doorAt(dressing.building(plotOf({ entrance: { cell: { x: 8, y: 6 }, facing: 'east' } }), { width: 12, depth: 8, height: 7.2 }))

    expect(north.z).toBeCloseTo(-6)
    expect(south.z).toBeCloseTo(6)
    expect(west.x).toBeCloseTo(-6)
    expect(east.x).toBeCloseTo(6)
    for (const door of [north, south]) expect(door.x).toBeCloseTo(0)
    for (const door of [west, east]) expect(door.z).toBeCloseTo(0)
  })

  it('stands the building on the plot, inside the relief it is allowed', () => {
    const building = dressing.building(plotOf(), { width: 8, depth: 12, height: 7.2 })
    const box = new THREE.Box3().setFromObject(building)
    expect(box.min.y).toBeCloseTo(0)
    expect(box.max.y).toBeLessThanOrEqual(7.2 + PROUD)
    expect(box.max.x).toBeLessThanOrEqual(4 + PROUD)
    expect(box.min.x).toBeGreaterThanOrEqual(-4 - PROUD)
    expect(box.max.z).toBeLessThanOrEqual(6 + PROUD)
    expect(box.min.z).toBeGreaterThanOrEqual(-6 - PROUD)
  })

  it('hands a shape it has no model for to the dressing behind', () => {
    const building = dressing.building(plotOf({ storeys: 9 }), { width: 8, depth: 12, height: 29.6 })
    expect(building.children.some((child) => child.name.endsWith(':shell'))).toBe(true)
  })

  it('gives @gb/scene something it can batch, so the city is one draw', () => {
    const world = World.create({ name: 'T', theme: 'neon', seed: 's', width: 40, height: 40 })
    for (let i = 0; i < 6; i++) {
      const added = world.addPlot({
        kind: 'shop',
        name: `Shop ${i}`,
        rect: { x: 4 + i * 5, y: 6, w: 4, h: 6 },
        entrance: { cell: { x: 6 + i * 5, y: 5 }, facing: 'north' },
        storeys: 2,
        style: 'neon-shop',
      })
      expect(added.ok).toBe(true)
    }

    const city = buildCity(world, dressing)
    const batches = city.root.children.filter((child) => child.name.startsWith('city:'))
    expect(batches.map((batch) => batch.name)).toEqual(['city:prefab:facade'])
    expect(city.buildings.size).toBe(6)
  })

  it('keeps the signs the kit would have hung, so a prefab street still has names on it', () => {
    const kit = new KitDressing(placeholderKit('a neon city'), new Greybox())
    const withSigns = new PrefabDressing(libraryOf(catalogue), kit)
    const plot = plotOf({ kind: 'bar', name: 'The Long Wire' })

    const building = withSigns.building(plot, { width: 8, depth: 12, height: 7.2 })
    const materials = building.children.map((child) => ((child as THREE.Mesh).material as THREE.Material).name)
    expect(materials).toContain(SIGN.material)
    expect(materials.filter((name) => name === 'prefab:facade')).toHaveLength(1)
  })
})
