import { KitDressing, SIGN, lightsFor, placeholderKit } from '@gb/kitbash'
import { Greybox, buildCity, storeyHeight } from '@gb/scene'
import { PLOT_BAND, TALLEST_STOREYS, World, type Plot, type ResolvedCharter } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PrefabDressing, type BuildingSize } from '../src/dressing.ts'
import { PROUD } from '../src/fit.ts'
import { PANE } from '../src/glass.ts'
import { GLASS_MATERIAL_NAME, MATERIAL_NAME, SHELL_MATERIAL_NAME } from '../src/pack.ts'
import { FINISHES, PLATE, catalogueOf, charterOf, libraryOf, plotOf } from './support.ts'

const catalogue = catalogueOf()
const dressing = new PrefabDressing(libraryOf(catalogue), new Greybox())

/** The plot, its size and its charter, the way the scene hands them over. */
function handed(plot: Plot, size: BuildingSize): [Plot, BuildingSize, ResolvedCharter] {
  return [plot, size, charterOf(plot)]
}

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

  it('hands a shape it has no model for to the dressing behind, a tower included', () => {
    const building = dressing.building(...handed(plotOf({ storeys: 9 }), { width: 8, depth: 12, height: 29.6 }))
    expect(building.children.some((child) => child.name.endsWith(':shell'))).toBe(true)

    // the pack is drawn to `PLOT_BAND.storeys.max` and a city's skyline stands over it,
    // so every tower goes to the kit at its own height rather than being shrunk into a bucket
    for (const storeys of [PLOT_BAND.storeys.max + 1, 24, TALLEST_STOREYS]) {
      const size = { width: 8, depth: 12, height: storeyHeight(storeys) }
      const plot = plotOf({ kind: 'office', storeys })
      const tower = new PrefabDressing(libraryOf(catalogue), new KitDressing(placeholderKit('a neon city'), new Greybox()))
      for (const drawn of [tower.building(...handed(plot, size)), tower.shell(...handed(plot, size))]) {
        const box = new THREE.Box3().setFromObject(drawn)
        expect(box.max.y, `${storeys} storeys`).toBeCloseTo(size.height, 1)
      }
    }
  })

  it('answers the far shell as the walls alone: no glass, no signs, the same entrance', () => {
    const kit = new KitDressing(placeholderKit('a neon city'), new Greybox())
    const withSigns = new PrefabDressing(libraryOf(catalogue), kit)
    const plot = plotOf({ kind: 'bar', name: 'The Long Wire', interiorId: 'interior_0001' })
    const shell = withSigns.shell(plot, { width: 8, depth: 12, height: 7.2 }, charterOf(plot))
    const meshes = shell.children.filter((child) => (child as THREE.Mesh).isMesh) as THREE.Mesh[]
    expect(meshes.map((mesh) => (mesh.material as THREE.Material).name)).toEqual([SHELL_MATERIAL_NAME])
    expect(finishesOn(shell)).toContain('door:open')
    // and nothing was hung on it, so no sign lights the pavement from a shell
    const kinds = withSigns.lights(plot, { width: 8, depth: 12, height: 7.2 }, charterOf(plot)).map((light) => light.kind)
    expect(kinds).toContain('entrance')
    expect(kinds).not.toContain('doorlamp')
  })

  it('stands a pane of glass off every windowed wall, on the second material, and nothing off the rest', () => {
    const building = dressing.building(...handed(plotOf(), { width: 8, depth: 12, height: 7.2 }))
    const meshes = building.children.filter((child) => (child as THREE.Mesh).isMesh) as THREE.Mesh[]
    expect(meshes.map((mesh) => (mesh.material as THREE.Material).name)).toEqual([MATERIAL_NAME, GLASS_MATERIAL_NAME])
    const [walls, glass] = meshes
    expect(glass!.castShadow).toBe(false)

    // the fixture shell wears the windowed wall: its four upright faces get a
    // pane each, its roof and floor none, and the door and the plate none
    expect(glass!.geometry.getIndex()!.count / 3).toBe(8)
    const layer = glass!.geometry.getAttribute('_layer')
    for (let i = 0; i < layer.count; i++) expect(FINISHES[Math.round(layer.getX(i))]).toBe('wall:facade-a')
    const box = new THREE.Box3().setFromBufferAttribute(glass!.geometry.getAttribute('position') as THREE.BufferAttribute)
    const shell = new THREE.Box3().setFromBufferAttribute(walls!.geometry.getAttribute('position') as THREE.BufferAttribute)
    expect(box.max.x).toBeCloseTo(4 + PANE.stand)
    expect(box.min.x).toBeCloseTo(-4 - PANE.stand)
    expect(box.max.z).toBeCloseTo(6 + PANE.stand)
    expect(box.min.z).toBeCloseTo(-6 - PANE.stand)
    expect(box.max.y).toBeCloseTo(shell.max.y)
    expect(box.min.y).toBeCloseTo(0)
  })

  it('gives @gb/scene something it can batch: every shell in one draw, and the walls and glass near the player in one each', () => {
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
    city.follow(12, 18)
    const batches = city.root.children.filter((child) => (child as THREE.BatchedMesh).isBatchedMesh && child.name !== 'clutter')
    expect(batches.map((batch) => batch.name)).toEqual([`city:${SHELL_MATERIAL_NAME}`, `detail:${MATERIAL_NAME}`, `detail:${GLASS_MATERIAL_NAME}`])
    expect(city.buildings.size).toBe(6)
  })

  it('keeps the signs the kit would have hung, so a prefab street still has names on it', () => {
    const kit = new KitDressing(placeholderKit('a neon city'), new Greybox())
    const withSigns = new PrefabDressing(libraryOf(catalogue), kit)
    const plot = plotOf({ kind: 'bar', name: 'The Long Wire' })

    const building = withSigns.building(plot, { width: 8, depth: 12, height: 7.2 }, charterOf(plot))
    const materials = building.children.map((child) => ((child as THREE.Mesh).material as THREE.Material).name)
    expect(materials).toContain(SIGN.material)
    expect(materials.filter((name) => name === MATERIAL_NAME)).toHaveLength(1)
    expect(materials.filter((name) => name === GLASS_MATERIAL_NAME)).toHaveLength(1)
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
