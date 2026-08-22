import { CLIPS } from '@gb/cast'
import { CityNav } from '@gb/nav'
import { METRICS, World, type CellKind } from '@gb/world'
import { beforeAll, describe, expect, it } from 'vitest'
import { Crowd, type CrowdOptions, type Point, type WalkerView } from '../src/index.ts'
import { FakeCast } from './support/fake-cast.ts'
import { testTown } from './support/town.ts'

const STEP = 1 / 60
const PAVEMENT: readonly CellKind[] = ['sidewalk', 'park']

let world: World
let nav: CityNav
let middle: Point

beforeAll(() => {
  world = testTown()
  if (world.check().length > 0) throw new Error(`test town is not sound: ${JSON.stringify(world.check())}`)
  nav = CityNav.from(world)
  middle = {
    x: (world.grid.width * world.cellSize) / 2,
    z: (world.grid.height * world.cellSize) / 2,
  }
})

function crowdOf(options: Partial<CrowdOptions> = {}, seed = 'walkers') {
  const cast = new FakeCast()
  const crowd = Crowd.create({ world, nav, cast, seed }, options)
  return { crowd, cast }
}

function kindUnder(where: Point): CellKind | undefined {
  return world.grid.at(Math.floor(where.x / world.cellSize), Math.floor(where.z / world.cellSize))
}

/** Walkers cross the road, so the ground rule is what they may never stand in, not where they start. */
function standsOnOpenGround(where: Point): boolean {
  const kind = kindUnder(where)
  return kind !== undefined && kind !== 'building' && kind !== 'mountain' && kind !== 'water'
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

describe('Crowd', () => {
  it('fills the pavement around the player and keeps to the population asked for', () => {
    const { crowd, cast } = crowdOf({ population: 24 })
    for (let i = 0; i < 60; i++) crowd.update(STEP, middle)

    expect(crowd.count).toBe(24)
    expect(cast.live.length).toBe(24)
    for (const walker of crowd.walkers()) {
      expect(distance(walker, middle)).toBeLessThanOrEqual(crowd.options.retireRadius)
      expect(standsOnOpenGround(walker)).toBe(true)
    }
  })

  it('walks a route at walking pace and never stands inside a building', () => {
    const { crowd, cast } = crowdOf({ population: 12 })
    const spread = METRICS.player.walkSpeed * (1 + crowd.options.speedSpread)
    const before = new Map<string, WalkerView>()

    for (let frame = 0; frame < 3600; frame++) {
      crowd.update(STEP, middle)
      for (const walker of crowd.walkers()) {
        expect(standsOnOpenGround(walker)).toBe(true)
        const previous = before.get(walker.id)
        if (previous && walker.state === 'walking' && previous.state === 'walking') {
          expect(distance(previous, walker)).toBeLessThanOrEqual(spread * STEP + 1e-9)
          // the only way the trip gets longer is a new route, and that only starts from idle
          expect(walker.remaining).toBeLessThan(previous.remaining)
        }
        if (previous?.state === 'idle' && walker.state === 'idle') expect(distance(previous, walker)).toBe(0)
        before.set(walker.id, walker)
      }
    }
    // feet on the kerb where there is one, down on the tarmac where there is not
    for (const actor of cast.live) {
      const onKerb = PAVEMENT.includes(kindUnder(actor) as CellKind)
      expect(actor.y).toBe(onKerb ? METRICS.street.curbHeight : 0)
    }
  })

  it('arrives, stands still for a moment, then goes somewhere else', () => {
    const { crowd, cast } = crowdOf({ population: 1, tripMin: 10, tripMax: 20, pauseMin: 2, pauseMax: 3 })
    let arrivals = 0
    let wasWalking = false

    for (let frame = 0; frame < 3600; frame++) {
      crowd.update(STEP, middle)
      const walker = crowd.walkers()[0]
      if (!walker) continue
      if (wasWalking && walker.state === 'idle') {
        arrivals++
        expect(walker.remaining).toBe(0)
        expect(walker.clip).toBe(CLIPS.idle)
      }
      if (walker.state === 'walking') expect(walker.clip).toBe(CLIPS.walk)
      wasWalking = walker.state === 'walking'
    }

    expect(arrivals).toBeGreaterThanOrEqual(2)
    const played = cast.made[0]!.clips
    expect(played.filter((clip) => clip === CLIPS.walk).length).toBeGreaterThanOrEqual(2)
  })

  it('turns to face the way it is going', () => {
    const { crowd } = crowdOf({ population: 8 })
    const going = new Map<string, { x: number; z: number; steady: number }>()
    let checked = 0

    for (let frame = 0; frame < 1800; frame++) {
      const was = new Map(crowd.walkers().map((walker) => [walker.id, walker]))
      crowd.update(STEP, middle)
      for (const walker of crowd.walkers()) {
        const previous = was.get(walker.id)
        if (!previous || walker.state !== 'walking') continue
        const moved = distance(previous, walker)
        if (moved < 1e-6) continue
        const x = (walker.x - previous.x) / moved
        const z = (walker.z - previous.z) / moved
        const seen = going.get(walker.id)
        const same = seen !== undefined && Math.abs(seen.x - x) < 1e-9 && Math.abs(seen.z - z) < 1e-9
        going.set(walker.id, { x, z, steady: same ? seen.steady + 1 : 0 })
        // half a second on one leg is long enough for any turn to have finished
        if ((going.get(walker.id)!.steady * STEP) < 0.5) continue
        // north is -Z, so this is the way the body is looking, and it must be the way it is moving
        const lookX = -Math.sin(walker.heading)
        const lookZ = -Math.cos(walker.heading)
        expect(lookX * x + lookZ * z).toBeGreaterThan(0.9999)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('retires the walkers the player has left behind', () => {
    const { crowd, cast } = crowdOf({ population: 10 })
    for (let i = 0; i < 60; i++) crowd.update(STEP, middle)
    const first = cast.live.slice()
    expect(first.length).toBe(10)

    const faraway = { x: middle.x + 400, z: middle.z + 400 }
    crowd.update(STEP, faraway)

    for (const actor of first) expect(actor.released).toBe(true)
    for (const walker of crowd.walkers()) expect(distance(walker, faraway)).toBeLessThanOrEqual(crowd.options.retireRadius)
  })

  it('gives back every body when it is cleared', () => {
    const { crowd, cast } = crowdOf({ population: 6 })
    for (let i = 0; i < 60; i++) crowd.update(STEP, middle)
    crowd.clear()

    expect(crowd.count).toBe(0)
    expect(cast.live).toEqual([])
  })

  it('is the same crowd from the same seed, and a later walker moves nobody already walking', () => {
    const run = (population: number) => {
      const { crowd } = crowdOf({ population })
      const seen: WalkerView[][] = []
      for (let i = 0; i < 600; i++) {
        crowd.update(STEP, middle)
        seen.push(crowd.walkers().map((walker) => ({ ...walker })))
      }
      return seen
    }

    const twice = [run(8), run(8)]
    expect(twice[0]).toEqual(twice[1])

    const alone = run(1).map((frame) => frame.filter((walker) => walker.id === 'walker_0'))
    const crowded = run(8).map((frame) => frame.filter((walker) => walker.id === 'walker_0'))
    expect(alone).toEqual(crowded)
  })

  it('finds nobody to walk in a city with no pavement, and says so by staying empty', () => {
    const bare = World.create({ name: 'Nowhere', theme: 'empty', seed: 'bare', width: 16, height: 16 })
    const crowd = Crowd.create({ world: bare, nav: CityNav.from(bare), cast: new FakeCast(), seed: 'bare' })

    for (let i = 0; i < 60; i++) crowd.update(STEP, { x: 16, z: 16 })
    expect(crowd.count).toBe(0)
    expect(crowd.walkers()).toEqual([])
  })
})
