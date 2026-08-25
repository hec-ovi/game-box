import { KitDressing, SIGN, lightsFor, placeholderKit } from '@gb/kitbash'
import { Greybox, buildCity } from '@gb/scene'
import { World, type Plot, type ResolvedCharter } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PrefabDressing, type BuildingSize } from '../src/dressing.ts'
import { PROUD } from '../src/fit.ts'
import { FINISHES, PLATE, catalogueOf, charterOf, libraryOf, plotOf } from './support.ts'

const catalogue = catalogueOf()
const dressing = new PrefabDressing(libraryOf(catalogue), new Greybox())

/** Where the door plate ended up, in the building's own frame. */
/** The plot, its size and its charter, the way the scene hands them over. */
function handed(plot: Plot, size: BuildingSize): [Plot, BuildingSize, ResolvedCharter] {
  return [plot, size, charterOf(plot)]
}

function doorAt(object: THREE.Object3D): THREE.Vector3 {
  const mesh = object.children[0] as THREE.Mesh
  const box = new THREE.Box3()
  const point = new THREE.Vector3()
  const position = mesh.geometry.getAttribute('position')
  const layer = mesh.geometry.getAttribute('_layer')
  for (let i = 0; i < position.count; i++) if (layer.getX(i) === 1) box.expandByPoint(point.fromBufferAttribute(position as THREE.BufferAttribute, i))
  return box.getCenter(new THREE.Vector3())
}

/** Every finish the building ended up wearing, by name. */
function finishesOn(object: THREE.Object3D): string[] {
  const layer = (object.children[0] as THREE.Mesh).geometry.getAttribute('_layer')
  const seen = new Set<number>()
  for (let i = 0; i < layer.count; i++) seen.add(Math.round(layer.getX(i)))
  return [...seen].sort((a, b) => a - b).map((index) => FINISHES[index]!)
}

/** The fixture plot turned a quarter: the same 8 by 12 m shape with its door on an east or west wall. */
const turned = { x: 4, y: 4, w: 6, h: 4 }

describe('dressing a plot', () => {
  it('puts the door on the wall the entrance is on, at all four points of the compass', () => {
    const north = doorAt(dressing.building(...handed(plotOf({ entrance: { cell: { x: 6, y: 3 }, facing: 'north' } }), { width: 8, depth: 12, height: 7.2 })))
    const south = doorAt(dressing.building(...handed(plotOf({ entrance: { cell: { x: 6, y: 10 }, facing: 'south' } }), { width: 8, depth: 12, height: 7.2 })))
    const west = doorAt(dressing.building(...handed(plotOf({ rect: turned, entrance: { cell: { x: 3, y: 6 }, facing: 'west' } }), { width: 12, depth: 8, height: 7.2 })))
    const east = doorAt(dressing.building(...handed(plotOf({ rect: turned, entrance: { cell: { x: 10, y: 6 }, facing: 'east' } }), { width: 12, depth: 8, height: 7.2 })))

    expect(north.z).toBeCloseTo(-6)
    expect(south.z).toBeCloseTo(6)
    expect(west.x).toBeCloseTo(-6)
    expect(east.x).toBeCloseTo(6)
    for (const door of [north, south]) expect(door.x).toBeCloseTo(0)
    for (const door of [west, east]) expect(door.z).toBeCloseTo(0)
  })

  it('stands the building on the plot, inside the relief it is allowed', () => {
    const building = dressing.building(...handed(plotOf(), { width: 8, depth: 12, height: 7.2 }))
    const box = new THREE.Box3().setFromObject(building)
    expect(box.min.y).toBeCloseTo(0)
    expect(box.max.y).toBeLessThanOrEqual(7.2 + PROUD)
    expect(box.max.x).toBeLessThanOrEqual(4 + PROUD)
    expect(box.min.x).toBeGreaterThanOrEqual(-4 - PROUD)
    expect(box.max.z).toBeLessThanOrEqual(6 + PROUD)
    expect(box.min.z).toBeGreaterThanOrEqual(-6 - PROUD)
  })

  it('gives a plot you can walk into the entrance you can walk through, and leaves every other door plain', () => {
    const size = { width: 8, depth: 12, height: 7.2 }
    expect(finishesOn(dressing.building(...handed(plotOf(), size)))).toEqual(['wall:facade-a', 'door'])
    expect(finishesOn(dressing.building(...handed(plotOf({ interiorId: 'interior_0001' }), size)))).toEqual(['wall:facade-a', 'door:open'])
  })

  it('hands a shape it has no model for to the dressing behind', () => {
    const building = dressing.building(...handed(plotOf({ storeys: 9 }), { width: 8, depth: 12, height: 29.6 }))
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

    const building = withSigns.building(plot, { width: 8, depth: 12, height: 7.2 }, charterOf(plot))
    const materials = building.children.map((child) => ((child as THREE.Mesh).material as THREE.Material).name)
    expect(materials).toContain(SIGN.material)
    expect(materials.filter((name) => name === 'prefab:facade')).toHaveLength(1)
  })

  it('publishes the light a building throws: its lit lobby, each screen, and the signs it hung', () => {
    const size = { width: 8, depth: 12, height: 7.2 }
    const shop = { pack: 'test', model: 'shop-8x12x2', mirror: false, rooms: 0 }

    // a door you can walk through, on the north wall, 25 cm out from a 10 cm plate
    const open = plotOf({ interiorId: 'interior_0001', design: shop })
    dressing.building(open, size, charterOf(open))
    const lit = dressing.lights(open, size, charterOf(open))
    expect(lit.map((light) => light.kind)).toEqual(['entrance', 'screen'])
    const [lobby, screen] = lit
    expect(lobby!.position.map((v) => +v.toFixed(2))).toEqual([0, 1.05, -6.25])
    expect(lobby!.colour).toBe(0xffdbaa)
    expect(lobby!.intensity).toBeGreaterThan(0)
    expect(lobby!.radius).toBeLessThanOrEqual(16)

    // the plate, turned with the building, at the mean colour of the fixture's grey picture
    expect(screen!.position.map((v) => +v.toFixed(2))).toEqual([-PLATE.x, PLATE.y, -6.25])
    expect(screen!.colour).toBe(0x808080)
    expect(screen!.intensity).toBeCloseTo(PLATE.wide * PLATE.tall * 20 * (128 / 255) ** 2.2 * 1.9, 3)

    // a door nobody can walk through throws nothing
    const shut = plotOf({ design: shop })
    dressing.building(shut, size, charterOf(shut))
    expect(dressing.lights(shut, size, charterOf(shut)).map((light) => light.kind)).toEqual(['screen'])

    // and the kit's own emitters ride along for the signs it hung
    const kit = new KitDressing(placeholderKit('a neon city'), new Greybox())
    const withSigns = new PrefabDressing(libraryOf(catalogue), kit)
    const named = plotOf({ kind: 'bar', name: 'The Long Wire', design: shop })
    withSigns.building(named, size, charterOf(named))
    const kinds = withSigns.lights(named, size, charterOf(named)).map((light) => light.kind)
    expect(kinds.slice(1)).toEqual(lightsFor(named, size, charterOf(named)).map((light) => light.kind))
    expect(kinds).toContain('doorlamp')
  })
})
