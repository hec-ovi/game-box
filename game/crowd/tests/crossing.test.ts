import { CityNav } from '@gb/nav'
import type { CellKind, World } from '@gb/world'
import { beforeAll, describe, expect, it } from 'vitest'
import { Crowd, type CrowdOptions, type WalkerView } from '../src/index.ts'
import { FakeCast } from './support/fake-cast.ts'
import { atCrossing, classTown, testTown } from './support/town.ts'

const STEP = 1 / 60

interface Town {
  readonly world: World
  readonly nav: CityNav
  readonly atCrossing: (x: number, y: number) => boolean
}

let grid: Town

beforeAll(() => {
  const world = testTown()
  grid = { world, nav: CityNav.from(world), atCrossing }
})

function cellOf(town: Town, walker: WalkerView): { x: number; y: number; kind: CellKind | undefined } {
  const x = Math.floor(walker.x / town.world.cellSize)
  const y = Math.floor(walker.z / town.world.cellSize)
  return { x, y, kind: town.world.grid.at(x, y) }
}

/** Walk one crowd for a while and watch every moment somebody steps off a kerb. */
function watch(seconds: number, viewer: { x: number; z: number }, options: Partial<CrowdOptions>, town: Town = grid) {
  const cast = new FakeCast()
  const crowd = Crowd.create({ world: town.world, nav: town.nav, cast, seed: 'crossing' }, options)
  const onRoad = new Map<string, boolean>()
  const steps: { at: boolean; x: number; y: number }[] = []
  const reached = { west: Infinity, east: -Infinity }
  for (let frame = 0; frame < seconds * 60; frame++) {
    crowd.update(STEP, viewer)
    for (const walker of crowd.walkers()) {
      const cell = cellOf(town, walker)
      const road = cell.kind === 'street'
      if (road && !(onRoad.get(walker.id) ?? false)) steps.push({ at: town.atCrossing(cell.x, cell.y), ...cell })
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

  it('crosses at a crossing on a road of any width, the avenue and the road out included', () => {
    const laid = classTown()
    const town = { world: laid.world, nav: CityNav.from(laid.world), atCrossing: laid.atCrossing }
    const across = laid.world.grid.width * laid.world.cellSize
    const { steps } = watch(
      400,
      { x: 24, z: 60 },
      { population: 1, spawnNear: 0, spawnFar: 14, tripMin: across * 0.5, tripMax: across, retireRadius: 500 },
      town,
    )

    expect(steps.length).toBeGreaterThan(6)
    expect(steps.filter((step) => !step.at)).toEqual([])
    // and it really did cross the widest roads in town, not only the streets
    const widths = new Set(steps.map((step) => laid.widthAt(step.x, step.y)))
    expect([...widths].sort((a, b) => b - a)[0]).toBe(9)
  })

  it('gets a walker from one side of the city to the other, over the roads in between', () => {
    const town = grid.world.grid.width * grid.world.cellSize
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
    // the far side of town is the last row of doors: every trip ends at one, and none is on the very edge
    expect(reached.east).toBeGreaterThan(town * 0.8)
    expect(steps.length).toBeGreaterThanOrEqual(4)
    expect(steps.filter((step) => !step.at)).toEqual([])
  })
})
