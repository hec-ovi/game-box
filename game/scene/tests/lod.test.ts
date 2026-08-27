import { World, type Plot } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, DETAIL_RADIUS, Greybox, plotOf, SHELL_RADIUS, type BuildingSize, type BuildingStep, type CityBuild, type Dressing } from '../src/index.ts'
import { bigTown } from './town.ts'

/**
 * Level of detail. A building is drawn one of three ways and the player's cell
 * picks which: its massing from across town, the shell its dressing drew from
 * down the street, its whole detail on the pavement. Only the skyline is held
 * for the whole town, so a city of any size costs the player's own
 * neighbourhood plus twelve triangles a plot, and the same cell always draws
 * the same town.
 */

/** Tight enough that a town of a few hundred metres stands at all three steps at once. */
const RINGS = { detail: 24, shell: 72 }

/** A greybox that counts what it was asked to build. */
class Counting extends Greybox {
  shells = 0
  details = 0
  override shell(plot: Plot, size: BuildingSize, charter: Parameters<Greybox['shell']>[2]): THREE.Object3D {
    this.shells++
    return super.shell(plot, size, charter)
  }
  override building(plot: Plot, size: BuildingSize, charter: Parameters<Greybox['building']>[2]): THREE.Object3D {
    this.details++
    return super.building(plot, size, charter)
  }
}

/** The plots drawn each way right now. */
function steps(city: CityBuild): Map<BuildingStep, Set<string>> {
  const found = new Map<BuildingStep, Set<string>>([['massing', new Set()], ['shell', new Set()], ['detail', new Set()]])
  for (const building of city.buildings.values()) found.get(building.step)!.add(building.plotId)
  return found
}

/** How far the nearest edge of a plot's footprint is from a point on the ground. */
function reach(world: World, plot: Plot, x: number, z: number): number {
  const cell = world.cellSize
  const dx = Math.max(plot.rect.x * cell - x, 0, x - (plot.rect.x + plot.rect.w) * cell)
  const dz = Math.max(plot.rect.y * cell - z, 0, z - (plot.rect.y + plot.rect.h) * cell)
  return Math.hypot(dx, dz)
}

/** Which way each plot should be drawn from a point on the ground, measured from the middle of its cell. */
function expected(world: World, x: number, z: number, rings = RINGS): Map<BuildingStep, Set<string>> {
  const cell = world.cellSize
  const at = { x: (Math.floor(x / cell) + 0.5) * cell, z: (Math.floor(z / cell) + 0.5) * cell }
  const want = new Map<BuildingStep, Set<string>>([['massing', new Set()], ['shell', new Set()], ['detail', new Set()]])
  for (const plot of world.plots()) {
    const away = reach(world, plot, at.x, at.z)
    want.get(away <= rings.detail ? 'detail' : away <= rings.shell ? 'shell' : 'massing')!.add(plot.id)
  }
  return want
}

/** A corner of town far from the spawn. */
function farCorner(world: World): { x: number; z: number } {
  return { x: world.grid.width * world.cellSize * 0.8, z: world.grid.height * world.cellSize * 0.8 }
}

describe('level of detail', () => {
  it('holds the skyline for the whole town and asks the dressing only for what is near', async () => {
    const world = await bigTown()
    const dressing = new Counting()
    const city = buildCity(world, dressing, RINGS)
    const drawn = steps(city)

    expect(drawn).toEqual(expected(world, city.spawn.x, city.spawn.z))
    expect(drawn.get('massing')!.size).toBeGreaterThan(world.plots().length / 2)
    expect(drawn.get('detail')!.size).toBeGreaterThan(0)
    // a greybox building is its shell with a door on it, so the shells are
    // counted once more per detail, and neither is asked for the far field
    expect(dressing.details).toBe(drawn.get('detail')!.size)
    expect(dressing.shells).toBe(drawn.get('shell')!.size + dressing.details * 2)

    // the skyline is one batch for the whole town, the shells one per material
    // near the player and the detail one more
    const names = city.root.children.map((child) => child.name)
    expect(names.filter((name) => name === 'city:massing')).toHaveLength(1)
    expect(names.filter((name) => name.startsWith('city:')).length).toBeGreaterThan(1)
    expect(names.filter((name) => name.startsWith('detail:')).length).toBeGreaterThan(0)
    // and the default reach is the one the contract publishes
    expect(steps(buildCity(world, new Greybox()))).toEqual(expected(world, city.spawn.x, city.spawn.z, { detail: DETAIL_RADIUS, shell: SHELL_RADIUS }))
  })

  it('stands the whole skyline in one batch, each plot the box it occupies in its charter colour', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Greybox(), RINGS)
    const skyline = city.root.children.find((child) => child.name === 'city:massing') as THREE.BatchedMesh

    expect(skyline.isBatchedMesh).toBe(true)
    expect((skyline.material as THREE.MeshStandardMaterial).vertexColors).toBe(true)
    // the box a plot occupies goes in once per colour and is placed per plot,
    // so a town of thousands is a handful of boxes of geometry
    const plots = skyline.userData['plots'] as string[]
    expect(plots).toHaveLength(world.plots().length)
    const kinds = new Set(world.plots().map((plot) => plot.kind))
    expect(new Set(plots.map((plotId, instance) => skyline.getGeometryIdAt(instance))).size).toBeLessThanOrEqual(kinds.size)

    const colour = new THREE.Color()
    const box = new THREE.Box3()
    const at = new THREE.Matrix4()
    for (const [instance, plotId] of plots.entries()) {
      const plot = world.plot(plotId)!
      // where the grid puts it, at the size the plot says, standing on the ground
      skyline.getBoundingBoxAt(skyline.getGeometryIdAt(instance), box)!.applyMatrix4(skyline.getMatrixAt(instance, at))
      const size = box.getSize(new THREE.Vector3())
      expect(size.x).toBeCloseTo(plot.rect.w * world.cellSize, 5)
      expect(size.z).toBeCloseTo(plot.rect.h * world.cellSize, 5)
      expect(box.min.y).toBeCloseTo(0, 5)
      const published = city.buildings.get(plotId)!.bounds
      expect(box.getCenter(new THREE.Vector3()).distanceTo(published.getCenter(new THREE.Vector3()))).toBeLessThan(1e-4)
      expect(size.distanceTo(published.getSize(new THREE.Vector3()))).toBeLessThan(1e-4)

      // painted the colour the charter says the place is, so a far skyline is
      // the town's own colours and not a field of grey
      const painted = skyline.geometry.getAttribute('color')
      const start = skyline.getGeometryRangeAt(skyline.getGeometryIdAt(instance))!.vertexStart
      colour.fromBufferAttribute(painted, start)
      expect(colour.getHex()).toBe(world.charter(plot.kind)!.tint)
    }
  })

  it('moves the shells and the detail with the player, and draws the same town from the same cell', async () => {
    const world = await bigTown()
    const dressing = new Counting()
    const city = buildCity(world, dressing, RINGS)
    const atSpawn = steps(city)
    const built = dressing.details

    // a step inside the same cell changes nothing and builds nothing
    city.follow(city.spawn.x + 0.3, city.spawn.z + 0.3)
    expect(steps(city)).toEqual(atSpawn)
    expect(dressing.details).toBe(built)

    // across town, the buildings there are dressed and the ones at the spawn are back to their massing
    const far = farCorner(world)
    city.follow(far.x, far.z)
    const there = steps(city)
    expect(there).toEqual(expected(world, far.x, far.z))
    expect([...there.get('detail')!].some((id) => atSpawn.get('detail')!.has(id))).toBe(false)
    expect(new Set(city.lights.emitters.map((one) => one.plotId))).toEqual(there.get('detail'))

    // and back at the spawn it is the town that was there at open, built again
    city.follow(city.spawn.x, city.spawn.z)
    expect(steps(city)).toEqual(atSpawn)
    expect(new Set(city.lights.emitters.map((one) => one.plotId))).toEqual(atSpawn.get('detail'))
    expect(dressing.details).toBe(built + there.get('detail')!.size + atSpawn.get('detail')!.size)
  })

  it('draws a building one way at a time, out of the batch its step belongs to, and a ray still names the plot', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Greybox(), RINGS)
    const raycaster = new THREE.Raycaster()
    const drawn = steps(city)

    for (const step of ['massing', 'shell', 'detail'] as const) {
      const plotId = [...drawn.get(step)!][0]!
      const building = city.buildings.get(plotId)!
      const centre = building.bounds.getCenter(new THREE.Vector3())
      raycaster.set(new THREE.Vector3(centre.x, 400, centre.z), new THREE.Vector3(0, -1, 0))
      const hits = raycaster.intersectObject(city.root, true).filter((hit) => plotOf(hit) === plotId)

      // one building, out of one batch: the coarser steps stand aside
      expect(hits.length, plotId).toBeGreaterThan(0)
      expect(new Set(hits.map((hit) => hit.object.name))).toEqual(new Set([hits[0]!.object.name]))
      expect(hits[0]!.object.name.startsWith(step === 'detail' ? 'detail:' : 'city:')).toBe(true)
      expect(hits[0]!.object.name === 'city:massing').toBe(step === 'massing')
    }
  })

  it('draws the whole building down the street for a dressing with no shell, and its massing beyond', async () => {
    const world = await bigTown()
    const grey = new Greybox()
    const whole: Dressing = {
      building: (plot, size, charter) => grey.building(plot, size, charter),
      lights: (plot, size) => grey.lights(plot, size),
      prop: (prop) => grey.prop(prop),
      character: (npc, doing) => grey.character(npc, doing),
      pickup: (item) => grey.pickup(item),
      ground: (kind) => grey.ground(kind),
      surface: (part) => grey.surface(part),
    }
    const city = buildCity(world, whole, RINGS)
    const near = steps(city)

    // no near ring at all: the far one draws the whole building and carries its light
    expect(near.get('detail')!.size).toBe(0)
    expect(city.root.children.some((child) => child.name.startsWith('detail:'))).toBe(false)
    expect(new Set(city.lights.emitters.map((one) => one.plotId))).toEqual(near.get('shell'))
    expect(near.get('massing')!.size).toBeGreaterThan(0)

    const far = farCorner(world)
    city.follow(far.x, far.z)
    expect(new Set(city.lights.emitters.map((one) => one.plotId))).toEqual(steps(city).get('shell'))
  })

  it('takes a building added later at the step its distance says, and drops it to its massing when the player leaves', () => {
    const world = World.create({ name: 'Growing', theme: 'test', seed: 'grow', width: 120, height: 120 })
    const first = world.addPlot({ kind: 'shop', name: 'First', rect: { x: 4, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' }, storeys: 2, style: 'plain' })
    if (!first.ok) throw new Error(first.error.code)
    const city = buildCity(world, new Greybox(), RINGS)

    const next = world.addPlot({ kind: 'shop', name: 'Next', rect: { x: 10, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 11, y: 7 }, facing: 'south' }, storeys: 2, style: 'plain' })
    const away = world.addPlot({ kind: 'shop', name: 'Away', rect: { x: 100, y: 100, w: 3, h: 3 }, entrance: { cell: { x: 101, y: 103 }, facing: 'south' }, storeys: 2, style: 'plain' })
    if (!next.ok || !away.ok) throw new Error('plot')
    expect(city.add(next.value).step).toBe('detail')
    expect(city.add(away.value).step).toBe('massing')
    expect(city.lights.emitters.map((one) => one.plotId)).toEqual([first.value.id, next.value.id])

    city.follow(101 * world.cellSize, 103 * world.cellSize)
    expect(city.buildings.get(away.value.id)!.step).toBe('detail')
    expect(city.buildings.get(first.value.id)!.step).toBe('massing')
  })

  it('builds a room on first entry, keeps it while the player is near, and lets it go when they are far', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Greybox())
    const interior = world.interiors()[0]!
    const plot = world.plot(interior.plotId)!
    const doorstep = city.doorsteps.get(plot.id)!

    expect(city.interiors.size).toBe(0)
    city.follow(doorstep.x, doorstep.z)
    const room = city.interior(interior.id)!
    expect(room.root.name).toBe(interior.id)
    expect(city.interior(interior.id)).toBe(room)
    expect(city.interiors).toEqual(new Set([interior.id]))
    expect(city.interior('interior_9999')).toBeUndefined()

    // still there a street away, gone across town, and built again on the next entry
    city.follow(doorstep.x + DETAIL_RADIUS / 2, doorstep.z)
    expect(city.interior(interior.id)).toBe(room)
    const far = farCorner(world)
    city.follow(far.x, far.z)
    expect(city.interiors.size).toBe(0)
    expect(room.root.children).toEqual([])
    city.follow(doorstep.x, doorstep.z)
    const again = city.interior(interior.id)!
    expect(again).not.toBe(room)
    expect(again.props.size).toBe(interior.furniture.length)
  })
})
