import { CityNav } from '@gb/nav'
import type { CellKind } from '@gb/world'
import { beforeAll, describe, expect, it } from 'vitest'
import { Crowd, type CrowdOptions, type WalkerView } from '../src/index.ts'
import { FakeCast } from './support/fake-cast.ts'
import { atCrossing, testTown } from './support/town.ts'

const STEP = 1 / 60

let world: ReturnType<typeof testTown>
let nav: CityNav

beforeAll(() => {
  world = testTown()
  nav = CityNav.from(world)
})

function cellOf(walker: WalkerView): { x: number; y: number; kind: CellKind | undefined } {
  const x = Math.floor(walker.x / world.cellSize)
  const y = Math.floor(walker.z / world.cellSize)
  return { x, y, kind: world.grid.at(x, y) }
}

/** Walk one crowd for a while and watch every moment somebody steps off a kerb. */
function watch(seconds: number, viewer: { x: number; z: number }, options: Partial<CrowdOptions>) {
  const cast = new FakeCast()
  const crowd = Crowd.create({ world, nav, cast, seed: 'crossing' }, options)
  const onRoad = new Map<string, boolean>()
  const steps: { at: boolean; x: number; y: number }[] = []
  const reached = { west: Infinity, east: -Infinity }
  for (let frame = 0; frame < seconds * 60; frame++) {
    crowd.update(STEP, viewer)
    for (const walker of crowd.walkers()) {
      const cell = cellOf(walker)
      const road = cell.kind === 'street'
      if (road && !(onRoad.get(walker.id) ?? false)) steps.push({ at: atCrossing(cell.x, cell.y), ...cell })
      onRoad.set(walker.id, road)
      reached.west = Math.min(reached.west, walker.x)
      reached.east = Math.max(reached.east, walker.x)
    }
  }
  return { crowd, steps, reached }
}

describe('crossing the road', () => {
  it('walks to a crossing instead of stepping off the kerb wherever the route touches the road', () => {
    const { steps } = watch(300, { x: 48, z: 48 }, { population: 1, spawnFar: 40, retireRadius: 300 })

    // it crosses, repeatedly, and every one of those crossings is at a crossing
    expect(steps.length).toBeGreaterThan(8)
    expect(steps.filter((step) => !step.at)).toEqual([])
  })

  it('will not walk to the other end of town for one: past the detour it crosses where it is, after looking', () => {
    const { steps } = watch(300, { x: 48, z: 48 }, { population: 1, spawnFar: 40, retireRadius: 300, crossingDetour: 0 })

    // with no patience for a detour the same walker steps off the kerb where the route does
    expect(steps.some((step) => !step.at)).toBe(true)
  })

  it('gets a walker from one side of the city to the other, over the roads in between', () => {
    const town = world.grid.width * world.cellSize
    const { steps, reached } = watch(600, { x: 8, z: 48 }, {
      population: 1,
      spawnNear: 0,
      spawnFar: 12,
      tripMin: town * 0.6,
      tripMax: town,
      pauseMin: 0,
      pauseMax: 0.5,
      retireRadius: 500,
    })

    // it started at the west kerb and it reached the far side, which is only possible over the roadways
    expect(reached.west).toBeLessThan(town * 0.15)
    expect(reached.east).toBeGreaterThan(town * 0.85)
    expect(steps.length).toBeGreaterThanOrEqual(4)
    expect(steps.filter((step) => !step.at)).toEqual([])
  })
})
