import { World } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, Greybox, type BuildingSize } from '../src/index.ts'
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
  it('draws a town of any size in one mesh per material, not one per building', () => {
    const world = bigTown()
    const root = buildCity(world, new Greybox()).root
    const { meshes, materials } = cost(root)
    const detail = cost(root, (name) => name.startsWith('detail:')).meshes

    expect(world.plots().length, 'a town worth budgeting for').toBeGreaterThan(120)
    // measured: 142 buildings over 23 materials, drawn in 23 meshes. The ground
    // is a mesh per surface, so a dressing sharing one material between two
    // surfaces costs a mesh more than it costs materials; the buildings near
    // the spawn are drawn in detail out of one more batch per material
    expect(meshes - detail).toBeLessThanOrEqual(materials + 8)
    expect(detail).toBeGreaterThan(0)
    expect(detail).toBeLessThanOrEqual(materials)
    // and the ceiling that matters: draws do not follow the buildings
    expect(meshes - detail).toBeLessThan(world.plots().length / 4)
  })

  it('draws every piece of rubbish in the city in one mesh', () => {
    const world = bigTown()
    const city = buildCity(world, new Greybox())
    const rubbish = city.root.children.filter((child) => child.name === 'clutter')

    expect(city.clutter.length).toBeGreaterThan(500)
    expect(rubbish).toHaveLength(1)
    // and a swept city pays for none of it
    expect(buildCity(world, new Greybox(), { clutter: false }).root.children.some((c) => c.name === 'clutter')).toBe(false)
  })

  it('costs no more draws for twenty times the town', () => {
    const small = town()
    const big = bigTown()
    const shells = (name: string) => !name.startsWith('detail:')
    const cheap = cost(buildCity(small, new Greybox()).root, shells)
    const dear = cost(buildCity(big, new Greybox()).root, shells)

    expect(big.plots().length).toBeGreaterThan(small.plots().length * 10)
    expect(dear.triangles).toBeGreaterThan(cheap.triangles * 4)
    // every draw the bigger town adds is a material the smaller one did not have
    expect(dear.meshes - cheap.meshes).toBeLessThanOrEqual(dear.materials - cheap.materials + 1)
  })

  it('keeps the triangles under the budget they were measured at', () => {
    const world = bigTown()
    const root = buildCity(world, new Greybox()).root
    const { triangles } = cost(root)
    // the stand-in ring is a block per verge cell, so it is charged to the
    // perimeter of the map and not to the buildings, and a game with @gb/land
    // in it hides the ring altogether
    const town = cost(root, (name) => name !== 'mountains')

    // measured: 71,302 for 142 buildings, ground, kerbs, paint, the stand-in
    // ring, the wet street surface and its rubbish, of which 24,192 is the
    // ring and 37,452 the rubbish. The rubbish scales with paved area rather
    // than with plots, which is why the budget moved rather than the rubbish
    // being thinned to fit a per-plot number. The buildings are 5,112 of it:
    // 1,704 of skyline (twelve triangles a plot, the whole town), the rest the
    // shells and the detail round the spawn. A greybox building is a box and a
    // door slab, so this is the floor a real kit is measured against, not a
    // target
    expect(triangles).toBeLessThan(75_000)
    expect(town.triangles / world.plots().length).toBeLessThan(400)
  })

  it('costs the skyline for the far field, whatever a building costs to draw', () => {
    const world = bigTown()
    const heavy = new THREE.MeshStandardMaterial({ color: 0x808080 })
    // a 32 by 24 sphere is 1,472 triangles: a hundred times what a plot costs
    // in the skyline, and what a real kit's shell is nearer to
    const lump = 1_472

    class Heavy extends Greybox {
      override shell(plot: Parameters<Greybox['shell']>[0], size: BuildingSize, charter: Parameters<Greybox['shell']>[2]): THREE.Object3D {
        const group = super.shell(plot, size, charter)
        group.add(new THREE.Mesh(new THREE.SphereGeometry(size.width / 2, 32, 24), heavy))
        return group
      }
    }

    const buildings = (name: string) => name.startsWith('city:') || name.startsWith('detail:')
    const plain = buildCity(world, new Greybox(), { detail: 24, shell: 72 })
    const dear = buildCity(world, new Heavy(), { detail: 24, shell: 72 })
    const worn = [...plain.buildings.values()].filter((one) => one.step !== 'massing').length
    const near = [...plain.buildings.values()].filter((one) => one.detailed).length

    // only the buildings in the rings pay: the far field is the same skyline
    // either way, so the town's cost is its neighbourhood and nothing else
    expect(worn).toBeLessThan(world.plots().length / 2)
    expect(cost(dear.root, buildings).triangles - cost(plain.root, buildings).triangles).toBe(lump * (worn + near))
    expect(cost(plain.root, (name) => name === 'city:massing').triangles).toBe(world.plots().length * 12)
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

  it('still culls each building on its own, and lets one be taken out of the city', () => {
    const world = bigTown()
    const city = buildCity(world, new Greybox())
    const all = city.root.children.filter((child) => (child as THREE.BatchedMesh).isBatchedMesh) as THREE.BatchedMesh[]
    const batches = all.filter((batch) => batch.name.startsWith('city:'))

    expect(batches.length).toBeGreaterThan(0)
    // a merge would draw the whole town every frame; a batch throws away what
    // the frustum does not reach, building by building, and piece of rubbish by
    // piece of rubbish
    for (const batch of all) expect(batch.perObjectFrustumCulled, batch.name).toBe(true)

    const buildings = all.filter((batch) => batch.userData['plots'] !== undefined)
    const drawnFrom = (building: { step: string }) =>
      buildings.filter((batch) =>
        building.step === 'detail' ? batch.name.startsWith('detail:') : building.step === 'massing' ? batch.name === 'city:massing' : batch.name.startsWith('city:') && batch.name !== 'city:massing',
      )
    const instancesOf = (plotId: string, list: THREE.BatchedMesh[]) =>
      list.flatMap((batch) => (batch.userData['plots'] as string[]).map((id, at) => ({ id, batch, at })).filter((one) => one.id === plotId))
    for (const plot of [world.plots()[0]!, world.plots().at(-1)!]) {
      const building = city.buildings.get(plot.id)!
      const drawn = instancesOf(plot.id, drawnFrom(building))
      expect(drawn.length, plot.id).toBeGreaterThan(0)
      expect(drawn.every(({ batch, at }) => batch.getVisibleAt(at))).toBe(true)

      building.visible = false
      expect(building.visible).toBe(false)
      expect(instancesOf(plot.id, buildings).every(({ batch, at }) => !batch.getVisibleAt(at))).toBe(true)

      building.visible = true
      expect(drawn.every(({ batch, at }) => batch.getVisibleAt(at))).toBe(true)
    }
  })
})
