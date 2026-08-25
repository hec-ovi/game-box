import type { Plot, World } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildCity, Greybox, type CityBuild, type Dressing } from '../src/index.ts'
import { otherTown, town } from './town.ts'

/**
 * Streaming a city round the player, over every shape of dressing a chain of
 * wrappers can hand over. A dressing decides what a building looks like; it
 * never decides whether there is one. So whatever it publishes, every plot the
 * world holds is standing on the ground at every step of a walk, and no
 * building's light is left burning over ground its building is not on.
 */

/** A `Greybox` with one seam member answered differently, the way a wrapper does. */
function greyboxWith(over: Partial<Dressing>): Dressing {
  const grey = new Greybox()
  return {
    building: (plot, size, charter) => grey.building(plot, size, charter),
    shell: (plot, size, charter) => grey.shell(plot, size, charter),
    lights: (plot, size) => grey.lights(plot, size),
    prop: (prop) => grey.prop(prop),
    character: (npc, doing) => grey.character(npc, doing),
    pickup: (item) => grey.pickup(item),
    ground: (kind) => grey.ground(kind),
    surface: (part) => grey.surface(part),
    ...over,
  }
}

/** A dressing that does not carry a far look at all. */
function withoutShell(): Dressing {
  const dressing = greyboxWith({})
  delete dressing.shell
  return dressing
}

const CHAINS: ReadonlyArray<{ how: string; dressing: () => Dressing }> = [
  { how: 'publishes a shell', dressing: () => new Greybox() },
  { how: 'publishes no shell at all', dressing: withoutShell },
  { how: 'carries a shell that answers nothing', dressing: () => greyboxWith({ shell: () => undefined as unknown as THREE.Object3D }) },
  { how: 'carries a shell that answers an empty object', dressing: () => greyboxWith({ shell: () => new THREE.Group() }) },
  { how: 'answers an empty object for the whole building', dressing: () => greyboxWith({ building: () => new THREE.Group() }) },
]

const RAY = new THREE.Raycaster()
const DOWN = new THREE.Vector3(0, -1, 0)

/** What the city has in it that is not a building: the ground, the paint and what lies on it. */
const STREET = /^(ground:|markings:|street:|clutter$|mountains$|lights$)/

/** Which plots the city is drawing right now, measured with a ray at the scene it built. */
function standing(city: CityBuild, world: World, plots: readonly Plot[]): Set<string> {
  const built = city.root.children.filter((child) => !STREET.test(child.name))
  const drawn = new Set<string>()
  for (const plot of plots) {
    const x = (plot.rect.x + plot.rect.w / 2) * world.cellSize
    const z = (plot.rect.y + plot.rect.h / 2) * world.cellSize
    RAY.set(new THREE.Vector3(x, 400, z), DOWN)
    if (RAY.intersectObjects(built, true).length > 0) drawn.add(plot.id)
  }
  return drawn
}

/** A walk that crosses the town cell by cell: east along the middle, then south down it. */
function* walk(world: World): Generator<{ x: number; z: number }> {
  const step = world.cellSize * 3
  const width = world.grid.width * world.cellSize
  const depth = world.grid.height * world.cellSize
  for (let x = step; x < width; x += step) yield { x, z: depth / 2 }
  for (let z = step; z < depth; z += step) yield { x: width / 2, z }
}

describe('streaming a city round the player', () => {
  for (const chain of CHAINS) {
    it(`draws every building at every distance, and lights only the ones it draws, when the dressing ${chain.how}`, async () => {
      for (const world of [await town(), await otherTown()]) {
        const city = buildCity(world, chain.dressing(), { clutter: false })
        const plots = world.plots()
        expect(plots.length).toBeGreaterThan(0)

        for (const at of [{ x: city.spawn.x, z: city.spawn.z }, ...walk(world)]) {
          city.follow(at.x, at.z)
          const where = `${world.id} from ${at.x.toFixed(0)},${at.z.toFixed(0)}`
          const drawn = standing(city, world, plots)
          for (const plot of plots) {
            expect(city.buildings.has(plot.id), `${plot.id} has no building, ${where}`).toBe(true)
            expect(drawn.has(plot.id), `${plot.id} is not drawn, ${where}`).toBe(true)
          }
          for (const emitter of city.lights.emitters) {
            expect(drawn.has(emitter.plotId), `a ${emitter.kind} burns over the undrawn ${emitter.plotId}, ${where}`).toBe(true)
          }
        }
      }
    })
  }
})
