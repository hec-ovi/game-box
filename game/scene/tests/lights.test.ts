import { World, type Plot } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, Greybox, LIVE_LIGHTS, type BuildingSize, type CityBuild, type Dressing, type LightEmitter } from '../src/index.ts'
import { bigTown } from './town.ts'

/**
 * The light the buildings throw onto the street. Every sign and lamp is
 * published as an emitter; only the nearest few to the camera are point
 * lights, because every lit material pays for every light in the frame.
 */

/** The point lights standing in the city, wherever they are in its tree. */
function lightsIn(city: CityBuild): THREE.PointLight[] {
  const found: THREE.PointLight[] = []
  city.root.traverse((child) => {
    if ((child as THREE.PointLight).isPointLight) found.push(child as THREE.PointLight)
  })
  return found
}

/** Where a light is, as the emitter it was given. */
function litFrom(light: THREE.PointLight): { x: number; z: number } {
  return { x: light.position.x, z: light.position.z }
}

/** A greybox whose buildings burn a sign on every storey as well as the door lamp, so a town has hundreds of emitters. */
class Signed extends Greybox {
  override lights(plot: Plot, size: BuildingSize): readonly LightEmitter[] {
    const signs: LightEmitter[] = []
    for (let storey = 0; storey < plot.storeys; storey++) {
      signs.push({ kind: 'sign', position: [0, 3 * storey + 2.5, -size.depth / 2 - 0.2], colour: 0x40e0ff, intensity: 30, radius: 12 })
    }
    return [...super.lights(plot, size), ...signs]
  }
}

/** One plot in an otherwise empty town, its door on the north wall. */
function onePlot(): { world: World; plot: Plot } {
  const world = World.create({ name: 'Lit', theme: 'test', seed: 'lit', width: 12, height: 12 })
  const plot = world.addPlot({ kind: 'bar', name: 'Lit Bar', rect: { x: 4, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 5, y: 3 }, facing: 'north' }, storeys: 1, style: 'plain' })
  if (!plot.ok) throw new Error(plot.error.code)
  return { world, plot: plot.value }
}

describe('the light the buildings throw', () => {
  it('keeps every emitter of the buildings drawn in detail and makes only the budget of them lights', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Signed())
    const detailed = [...city.buildings.values()].filter((building) => building.detailed)

    expect(detailed.length).toBeGreaterThan(LIVE_LIGHTS)
    expect(city.lights.emitters.length).toBeGreaterThanOrEqual(detailed.length * 2)
    expect(new Set(city.lights.emitters.map((one) => one.plotId))).toEqual(new Set(detailed.map((one) => one.plotId)))
    const lights = lightsIn(city)
    expect(lights).toHaveLength(LIVE_LIGHTS)
    // every one of them is burning something: the town has more emitters than lights
    expect(lights.every((light) => light.visible && light.intensity > 0)).toBe(true)
  })

  it('places the light where the emitter is in the city, not where it is on the building', () => {
    const { world, plot } = onePlot()
    const city = buildCity(world, new Greybox())
    const bounds = city.buildings.get(plot.id)!.bounds
    const centre = bounds.getCenter(new THREE.Vector3())
    const size = { width: plot.rect.w * world.cellSize, depth: plot.rect.h * world.cellSize, height: bounds.max.y }
    const [emitter] = new Greybox().lights(plot, size)
    const [light] = lightsIn(city).filter((one) => one.visible)

    expect(light).toBeDefined()
    // the building's own frame carried to where it stands, and nothing turned
    expect(light!.position.x).toBeCloseTo(centre.x + emitter!.position[0], 5)
    expect(light!.position.y).toBeCloseTo(emitter!.position[1], 5)
    expect(light!.position.z).toBeCloseTo(centre.z + emitter!.position[2], 5)
    // over the door, just outside the north wall, above the door head
    expect(light!.position.z).toBeLessThan(bounds.min.z)
    expect(light!.position.y).toBeGreaterThan(2.1)
    expect(Math.abs(light!.position.x - city.doorsteps.get(plot.id)!.x)).toBeLessThan(world.cellSize)
    // the emitter's own colour and reach, falling off like a real lamp
    expect(light!.color.getHex()).toBe(emitter!.colour)
    expect(light!.distance).toBe(emitter!.radius)
    expect(light!.decay).toBe(2)
    expect(light!.intensity).toBe(emitter!.intensity)
  })

  it('gives the lights to the emitters nearest the camera, and moves them when it moves', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Signed())
    const nearest = (x: number, z: number) =>
      [...city.lights.emitters].sort((a, b) => Math.hypot(a.position[0] - x, a.position[2] - z) - Math.hypot(b.position[0] - x, b.position[2] - z)).slice(0, LIVE_LIGHTS)
    const farthest = (x: number, z: number) => Math.max(...nearest(x, z).map((one) => Math.hypot(one.position[0] - x, one.position[2] - z)))

    // built, the lights stand round the spawn
    const atSpawn = lightsIn(city).map(litFrom)
    for (const light of atSpawn) expect(Math.hypot(light.x - city.spawn.x, light.z - city.spawn.z)).toBeLessThanOrEqual(farthest(city.spawn.x, city.spawn.z) + 1e-6)

    // walked to the far corner of town, they are the ones there
    const far = { x: world.grid.width * world.cellSize * 0.8, z: world.grid.height * world.cellSize * 0.8 }
    city.follow(far.x, far.z)
    const there = lightsIn(city).map(litFrom)
    for (const light of there) expect(Math.hypot(light.x - far.x, light.z - far.z)).toBeLessThanOrEqual(farthest(far.x, far.z) + 1e-6)
    expect(there.some((light) => atSpawn.some((was) => was.x === light.x && was.z === light.z))).toBe(false)
  })

  it('fades a light in and out over the frames rather than switching it on', async () => {
    const world = await bigTown()
    const city = buildCity(world, new Signed(), { night: 1 })
    const candela = (light: THREE.PointLight) => (light.userData['emitter'] as { intensity: number }).intensity
    const lit = () => lightsIn(city).filter((one) => one.visible)
    const far = { x: world.grid.width * world.cellSize * 0.8, z: world.grid.height * world.cellSize * 0.8 }

    // opened, they are already at full: a city's first frame is not a fade
    for (const light of lit()) expect(light.intensity).toBeCloseTo(candela(light), 9)

    const wasLit = new Set(lit().map((light) => light.userData['emitter']))

    // one frame of a walk to the far corner, and nothing has teleported: every
    // light burning is still one the player was standing among
    city.follow(far.x, far.z, 1 / 60)
    const going = lit()
    expect(going.length).toBeGreaterThan(0)
    for (const light of going) expect(wasLit.has(light.userData['emitter'])).toBe(true)

    // a second and a half of frames later they have arrived, at the far corner,
    // at full, and none of the spawn's is left burning
    for (let frame = 0; frame < 90; frame++) city.follow(far.x, far.z, 1 / 60)
    const there = lit()
    expect(there).toHaveLength(LIVE_LIGHTS)
    for (const light of there) {
      expect(wasLit.has(light.userData['emitter'])).toBe(false)
      expect(light.intensity).toBeCloseTo(candela(light), 9)
    }
  })

  it('burns with the night: full after dark, off at noon', () => {
    const { world } = onePlot()
    const city = buildCity(world, new Greybox(), { night: 0.5 })
    const [light] = lightsIn(city).filter((one) => one.visible)
    const candela = city.lights.emitters[0]!.intensity

    expect(light!.intensity).toBeCloseTo(candela * 0.5, 9)
    city.night = 0
    expect(light!.intensity).toBe(0)
    city.night = 1
    expect(light!.intensity).toBe(candela)
  })

  it('lights a building added to a standing city', () => {
    const { world } = onePlot()
    const city = buildCity(world, new Greybox())
    expect(city.lights.emitters).toHaveLength(1)

    const later = world.addPlot({ kind: 'shop', name: 'Later', rect: { x: 8, y: 4, w: 3, h: 3 }, entrance: { cell: { x: 9, y: 3 }, facing: 'north' }, storeys: 1, style: 'plain' })
    if (!later.ok) throw new Error(later.error.code)
    city.add(later.value)

    expect(city.lights.emitters).toHaveLength(2)
    expect(city.lights.emitters[1]!.plotId).toBe(later.value.id)
    expect(lightsIn(city).filter((one) => one.visible)).toHaveLength(2)
  })

  it('lights nothing for a dressing that publishes nothing', () => {
    const { world } = onePlot()
    const grey = new Greybox()
    const dark: Dressing = {
      building: (plot, size, charter) => grey.building(plot, size, charter),
      prop: (prop) => grey.prop(prop),
      character: (npc, doing) => grey.character(npc, doing),
      pickup: (item) => grey.pickup(item),
      ground: (kind) => grey.ground(kind),
      surface: (part) => grey.surface(part),
    }
    const city = buildCity(world, dark)

    expect(city.lights.emitters).toEqual([])
    expect(lightsIn(city).filter((one) => one.visible)).toEqual([])
  })
})
