import { World } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, Greybox } from '../src/index.ts'
import { bigTown, town } from './town.ts'

/** What one city costs to draw, counted the way a renderer counts it. */
function cost(root: THREE.Object3D, only: (name: string) => boolean = () => true): { meshes: number; triangles: number; materials: number } {
  let meshes = 0
  let triangles = 0
  const materials = new Set<THREE.Material>()

  root.traverse((child) => {
    const mesh = child as THREE.Mesh & { isMesh?: boolean; isInstancedMesh?: boolean; isBatchedMesh?: boolean; count?: number }
    if (!mesh.isMesh || !only(mesh.name)) return
    meshes++
    for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) materials.add(material)

    const geometry = mesh.geometry
    const index = geometry.getIndex()
    const perDraw = (index ? index.count : geometry.getAttribute('position').count) / 3
    if (mesh.isBatchedMesh) {
      // per instance, not per geometry: a batch that draws one model a thousand
      // times draws a thousand copies of its triangles
      const held = (mesh as unknown as { _geometryInfo: Array<{ count: number }> })._geometryInfo
      const drawn = (mesh as unknown as { _instanceInfo: Array<{ geometryIndex: number; active: boolean }> })._instanceInfo
      triangles += drawn.reduce((total, one) => total + (one.active ? held[one.geometryIndex]!.count / 3 : 0), 0)
    } else {
      triangles += perDraw * (mesh.isInstancedMesh ? (mesh.count ?? 1) : 1)
    }
  })
  return { meshes, triangles, materials: materials.size }
}

describe('what a city costs', () => {
  it('draws a town of any size in one mesh per material, not one per building', async () => {
    const world = await bigTown()
    const { meshes, materials } = cost(buildCity(world, new Greybox()).root)

    expect(world.plots().length, 'a town worth budgeting for').toBeGreaterThan(120)
    // measured: 142 buildings over 23 materials, drawn in 23 meshes. The ground
    // is a mesh per surface, so a dressing sharing one material between two
    // surfaces costs a mesh more than it costs materials
    expect(meshes).toBeLessThanOrEqual(materials + 8)
    // and the ceiling that matters: draws do not follow the buildings
    expect(meshes).toBeLessThan(world.plots().length / 4)
  })

  it('draws every piece of rubbish in the city in one mesh', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Greybox())
    const rubbish = city.root.children.filter((child) => child.name === 'clutter')

    expect(city.clutter.length).toBeGreaterThan(500)
    expect(rubbish).toHaveLength(1)
    // and a swept city pays for none of it
    expect(buildCity(world, new Greybox(), { clutter: false }).root.children.some((c) => c.name === 'clutter')).toBe(false)
  })

  it('costs no more draws for twenty times the town', async () => {
    const small = await town()
    const big = await bigTown()
    const cheap = cost(buildCity(small, new Greybox()).root)
    const dear = cost(buildCity(big, new Greybox()).root)

    expect(big.plots().length).toBeGreaterThan(small.plots().length * 10)
    expect(dear.triangles).toBeGreaterThan(cheap.triangles * 4)
    // every draw the bigger town adds is a material the smaller one did not have
    expect(dear.meshes - cheap.meshes).toBeLessThanOrEqual(dear.materials - cheap.materials + 1)
  })

  it('keeps the triangles under the budget they were measured at', async () => {
    const world = await bigTown()
    const { triangles } = cost(buildCity(world, new Greybox()).root)

    // measured: 48,668 for 141 buildings, ground, kerbs, paint, the mountain
    // ring, the wet street surface and 2,318 pieces of rubbish. It was 26,914
    // before the street carried anything: the rubbish is 20,936 of the rise and
    // it scales with paved area rather than with plots, which is why the budget
    // moved rather than the rubbish being thinned to fit a per-plot number. A
    // greybox building is a box and a door slab, so this is the floor a real
    // kit is measured against, not a target
    expect(triangles).toBeLessThan(60_000)
    expect(triangles / world.plots().length).toBeLessThan(400)
  })

  it('takes another building without rebuilding the city', () => {
    const world = World.create({ name: 'Growing', theme: 'test', seed: 'grow', width: 20, height: 20 })
    const first = world.addPlot({ kind: 'shop', name: 'First', rect: { x: 4, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' }, storeys: 2, style: 'plain' })
    if (!first.ok) throw new Error(first.error.code)
    const city = buildCity(world, new Greybox())
    const before = cost(city.root)

    const later = world.addPlot({ kind: 'shop', name: 'Later', rect: { x: 10, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 11, y: 7 }, facing: 'south' }, storeys: 2, style: 'plain' })
    if (!later.ok) throw new Error(later.error.code)
    const building = city.add(later.value)
    const after = cost(city.root)

    expect(building.plotId).toBe(later.value.id)
    expect(city.buildings.get(later.value.id)).toBe(building)
    expect(city.doorsteps.get(later.value.id)).toBeDefined()
    // it went into the buffers that were already there: no draw of its own,
    // and the pair costs what building the pair outright costs. Only the
    // buildings are compared: the ground was laid before the plot existed
    const batches = (root: THREE.Object3D) => cost(root, (name) => name.startsWith('city:'))
    const wholesale = batches(buildCity(world, new Greybox()).root)
    expect(after.meshes).toBe(before.meshes)
    expect(batches(city.root).meshes).toBe(wholesale.meshes)
    expect(batches(city.root).triangles).toBe(wholesale.triangles)
    expect(after.triangles).toBeGreaterThan(before.triangles)
    // and it stands where the grid says, not on top of the first one
    expect(building.bounds.intersectsBox(city.buildings.get(first.value.id)!.bounds)).toBe(false)
    expect(building.bounds.min.x).toBeCloseTo(10 * world.cellSize, 5)
  })

  it('still culls each building on its own, and lets one be taken out of the city', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Greybox())
    const all = city.root.children.filter((child) => (child as THREE.BatchedMesh).isBatchedMesh) as THREE.BatchedMesh[]
    const batches = all.filter((batch) => batch.name.startsWith('city:'))

    expect(batches.length).toBeGreaterThan(0)
    // a merge would draw the whole town every frame; a batch throws away what
    // the frustum does not reach, building by building, and piece of rubbish by
    // piece of rubbish
    for (const batch of all) expect(batch.perObjectFrustumCulled, batch.name).toBe(true)

    const plot = world.plots()[0]!
    const building = city.buildings.get(plot.id)!
    building.visible = false
    expect(building.visible).toBe(false)
    expect(batches.some((batch) => (batch.userData['plots'] as string[]).some((id, at) => id === plot.id && !batch.getVisibleAt(at)))).toBe(true)

    building.visible = true
    expect(batches.every((batch) => (batch.userData['plots'] as string[]).every((id, at) => id !== plot.id || batch.getVisibleAt(at)))).toBe(true)
  })
})
