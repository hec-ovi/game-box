import { World, type Plot } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, DETAIL_RADIUS, Greybox, plotOf, type BuildingSize, type CityBuild, type Dressing } from '../src/index.ts'
import { bigTown } from './town.ts'

/**
 * Level of detail. Every building is batched as its shell at open; the ones
 * near the player wear their detail (here, the greybox door slab and its lamp)
 * and that set moves with the player's cell, so a city of any size costs what
 * the player's own neighbourhood costs, and the same cell always draws the
 * same town.
 */

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

function detailed(city: CityBuild): Set<string> {
  return new Set([...city.buildings.values()].filter((one) => one.detailed).map((one) => one.plotId))
}

/** How far the nearest edge of a plot's footprint is from a point on the ground. */
function reach(world: World, plot: Plot, x: number, z: number): number {
  const cell = world.cellSize
  const dx = Math.max(plot.rect.x * cell - x, 0, x - (plot.rect.x + plot.rect.w) * cell)
  const dz = Math.max(plot.rect.y * cell - z, 0, z - (plot.rect.y + plot.rect.h) * cell)
  return Math.hypot(dx, dz)
}

/** The middle of the cell a point is in. */
function middleOf(world: World, x: number, z: number): { x: number; z: number } {
  const cell = world.cellSize
  return { x: (Math.floor(x / cell) + 0.5) * cell, z: (Math.floor(z / cell) + 0.5) * cell }
}

/** A corner of town far from the spawn. */
function farCorner(world: World): { x: number; z: number } {
  return { x: world.grid.width * world.cellSize * 0.8, z: world.grid.height * world.cellSize * 0.8 }
}

describe('level of detail', () => {
  it('batches every building as its shell and dresses only the ones near the spawn', async () => {
    const world = await bigTown()
    const dressing = new Counting()
    const city = buildCity(world, dressing)
    const near = detailed(city)

    // a greybox building is its shell with a door on it, so the shells are counted once more per detail
    expect(dressing.details).toBe(near.size)
    expect(dressing.shells).toBe(world.plots().length + near.size)
    expect(near.size).toBeGreaterThan(0)
    expect(near.size).toBeLessThan(world.plots().length / 2)
    // near is measured from the middle of the spawn's cell to the plot's footprint
    const at = middleOf(world, city.spawn.x, city.spawn.z)
    for (const plot of world.plots()) {
      expect(near.has(plot.id), plot.id).toBe(reach(world, plot, at.x, at.z) <= DETAIL_RADIUS)
    }
    // the shells are one batch per material and the detail one more, not one object each
    const names = city.root.children.map((child) => child.name)
    expect(names.filter((name) => name.startsWith('city:')).length).toBeGreaterThan(0)
    expect(names.filter((name) => name.startsWith('detail:')).length).toBeGreaterThan(0)
    expect(names.filter((name) => name.startsWith('detail:')).length).toBeLessThanOrEqual(names.filter((name) => name.startsWith('city:')).length)
  })

  it('moves the detail with the player, and draws the same town from the same cell', async () => {
    const world = await bigTown()
    const dressing = new Counting()
    const city = buildCity(world, dressing)
    const atSpawn = detailed(city)
    const built = dressing.details

    // a step inside the same cell changes nothing and builds nothing
    city.follow(city.spawn.x + 0.3, city.spawn.z + 0.3)
    expect(detailed(city)).toEqual(atSpawn)
    expect(dressing.details).toBe(built)

    // across town, the buildings there are dressed and the ones at the spawn are shells again
    const far = farCorner(world)
    city.follow(far.x, far.z)
    const there = detailed(city)
    const at = middleOf(world, far.x, far.z)
    for (const plot of world.plots()) expect(there.has(plot.id), plot.id).toBe(reach(world, plot, at.x, at.z) <= DETAIL_RADIUS)
    expect([...there].some((id) => atSpawn.has(id))).toBe(false)
    expect(new Set(city.lights.emitters.map((one) => one.plotId))).toEqual(there)

    // and back at the spawn it is the town that was there at open, built again
    city.follow(city.spawn.x, city.spawn.z)
    expect(detailed(city)).toEqual(atSpawn)
    expect(new Set(city.lights.emitters.map((one) => one.plotId))).toEqual(atSpawn)
    expect(dressing.details).toBe(built + there.size + atSpawn.size)
  })

  it('draws a far building from its shell and a near one from its detail, and a ray still names the plot', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Greybox())
    const raycaster = new THREE.Raycaster()
    const near = [...city.buildings.values()].find((one) => one.detailed)!
    const far = [...city.buildings.values()].find((one) => !one.detailed)!

    for (const building of [near, far]) {
      const centre = building.bounds.getCenter(new THREE.Vector3())
      raycaster.set(new THREE.Vector3(centre.x, 200, centre.z), new THREE.Vector3(0, -1, 0))
      const hits = raycaster.intersectObject(city.root, true).filter((hit) => plotOf(hit) === building.plotId)
      // one building, out of one batch: the shell steps aside for the detail
      expect(hits.length, building.plotId).toBeGreaterThan(0)
      expect(new Set(hits.map((hit) => hit.object.name))).toEqual(new Set([hits[0]!.object.name]))
      expect(hits[0]!.object.name.startsWith(building.detailed ? 'detail:' : 'city:')).toBe(true)
    }
  })

  it('draws the whole building at every distance for a dressing with no shell', async () => {
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
    const city = buildCity(world, whole)

    expect(detailed(city).size).toBe(0)
    expect(city.root.children.some((child) => child.name.startsWith('detail:'))).toBe(false)
    expect(city.lights.emitters.length).toBe(world.plots().length)
    const far = farCorner(world)
    city.follow(far.x, far.z)
    expect(city.lights.emitters.length).toBe(world.plots().length)
  })

  it('takes a building added later in detail when it is near and as a shell when it is not', () => {
    const world = World.create({ name: 'Growing', theme: 'test', seed: 'grow', width: 120, height: 120 })
    const first = world.addPlot({ kind: 'shop', name: 'First', rect: { x: 4, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 5, y: 7 }, facing: 'south' }, storeys: 2, style: 'plain' })
    if (!first.ok) throw new Error(first.error.code)
    const city = buildCity(world, new Greybox())

    const next = world.addPlot({ kind: 'shop', name: 'Next', rect: { x: 10, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 11, y: 7 }, facing: 'south' }, storeys: 2, style: 'plain' })
    const away = world.addPlot({ kind: 'shop', name: 'Away', rect: { x: 100, y: 100, w: 3, h: 3 }, entrance: { cell: { x: 101, y: 103 }, facing: 'south' }, storeys: 2, style: 'plain' })
    if (!next.ok || !away.ok) throw new Error('plot')
    expect(city.add(next.value).detailed).toBe(true)
    expect(city.add(away.value).detailed).toBe(false)
    expect(city.lights.emitters.map((one) => one.plotId)).toEqual([first.value.id, next.value.id])

    city.follow(101 * world.cellSize, 103 * world.cellSize)
    expect(city.buildings.get(away.value.id)!.detailed).toBe(true)
    expect(city.buildings.get(first.value.id)!.detailed).toBe(false)
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
