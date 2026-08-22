import { CityNav } from '@gb/nav'
import type { CellKind, World } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Crowd, type CrowdNav, type CrowdOptions, type Point, type WalkerView } from '../src/index.ts'
import { FakeCast } from './support/fake-cast.ts'
import { MeetNav } from './support/fake-nav.ts'
import { corridor, testTown } from './support/town.ts'

const STEP = 1 / 60

/**
 * The corridor is one pavement row with a road either side. Its middle column
 * is the only place the crowd will put anybody down when the spawn ring is set
 * to the two cells sixteen metres away, so a test knows who starts where.
 */
const CELLS = 60
const MIDDLE = 20
const CORRIDOR = { ring: { spawnNear: 16, spawnFar: 17 }, meet: MIDDLE }

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function closest(walkers: readonly WalkerView[], to: Point): number {
  let nearest = Infinity
  for (const walker of walkers) nearest = Math.min(nearest, distance(walker, to))
  return nearest
}

function crowdIn(world: World, nav: CrowdNav, options: Partial<CrowdOptions>) {
  return Crowd.create({ world, nav, cast: new FakeCast(), seed: 'avoid' }, options)
}

describe('people keep out of each other', () => {
  it('two walking straight at each other pass, and never come inside personal space', () => {
    const world = corridor(CELLS)
    const nav = new MeetNav(world.cellSize, 60, CORRIDOR.meet)
    // off the pavement and clear of where they meet, so the player is not part of this
    const viewer = { x: (MIDDLE + 0.5) * world.cellSize, z: 9 }
    const crowd = crowdIn(world, nav, { population: 2, retireRadius: 500, ...CORRIDOR.ring })

    let tightest = Infinity
    let started = 0
    let ended = 0

    for (let frame = 0; frame < 1500; frame++) {
      crowd.update(STEP, viewer)
      const [one, two] = crowd.walkers()
      if (!one || !two) continue
      const apart = Math.sign(one.x - two.x)
      if (started === 0) started = apart
      ended = apart
      tightest = Math.min(tightest, distance(one, two))
    }

    // they were both there and they started on opposite sides of the meeting point
    expect(started).not.toBe(0)

    // close enough that they had to deal with each other, never closer than the promise
    expect(tightest).toBeLessThan(crowd.options.avoidRadius)
    expect(tightest).toBeGreaterThanOrEqual(crowd.options.personalSpace - 1e-9)
    // and they ended up swapped, so they went past each other rather than giving up
    expect(ended).toBe(-started)
  })

  it('one walking straight at the player goes round rather than through', () => {
    const world = corridor(CELLS)
    const nav = new MeetNav(world.cellSize, 60, CORRIDOR.meet)
    // the player standing on the pavement, right in the way
    const viewer = { x: (MIDDLE + 0.5) * world.cellSize, z: 5 }
    const crowd = crowdIn(world, nav, { population: 1, retireRadius: 500, ...CORRIDOR.ring })

    let tightest = Infinity
    let started = 0
    let ended = 0

    for (let frame = 0; frame < 1500; frame++) {
      crowd.update(STEP, viewer)
      const walker = crowd.walkers()[0]
      if (!walker) continue
      const side = Math.sign(walker.x - viewer.x)
      if (started === 0) started = side
      ended = side
      tightest = Math.min(tightest, distance(walker, viewer))
    }

    expect(started).not.toBe(0)

    expect(tightest).toBeLessThan(crowd.options.avoidRadius)
    expect(tightest).toBeGreaterThanOrEqual(crowd.options.personalSpace - 1e-9)
    // it came out the other side, so it went round the player instead of stopping in front of them
    expect(ended).toBe(-started)
  })

  it('a pavement full of people keeps flowing, stays out of the walls, and keeps its distance', () => {
    const world = testTown()
    const nav = CityNav.from(world)
    const middle = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
    const crowd = Crowd.create({ world, nav, cast: new FakeCast(), seed: 'busy' }, { population: 40, spawnNear: 4, spawnFar: 26 })

    const arrived = new Set<string>()
    const wasWalking = new Set<string>()
    let tightest = Infinity
    let nearestToPlayer = Infinity

    for (let frame = 0; frame < 3600; frame++) {
      crowd.update(STEP, middle)
      const walkers = crowd.walkers()
      for (let i = 0; i < walkers.length; i++) {
        const walker = walkers[i]!
        const kind: CellKind | undefined = world.grid.at(
          Math.floor(walker.x / world.cellSize),
          Math.floor(walker.z / world.cellSize),
        )
        // an elbow in the ribs is no excuse for standing in a wall
        expect(kind === 'street' || kind === 'sidewalk' || kind === 'park').toBe(true)
        if (walker.state === 'idle' && wasWalking.has(walker.id)) arrived.add(walker.id)
        if (walker.state === 'walking') wasWalking.add(walker.id)
        for (let j = i + 1; j < walkers.length; j++) tightest = Math.min(tightest, distance(walker, walkers[j]!))
      }
      nearestToPlayer = Math.min(nearestToPlayer, closest(walkers, middle))
    }

    expect(crowd.count).toBe(40)
    expect(tightest).toBeGreaterThanOrEqual(crowd.options.personalSpace - 1e-9)
    expect(nearestToPlayer).toBeGreaterThanOrEqual(crowd.options.personalSpace - 1e-9)
    // a minute of walking on a busy pavement, and every last one of them got somewhere: nobody deadlocked
    expect(arrived.size).toBeGreaterThanOrEqual(40)
  })

  it('gets out from under a player who parks on top of them, and stays out', () => {
    const world = testTown()
    const nav = CityNav.from(world)
    const middle = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
    const crowd = Crowd.create({ world, nav, cast: new FakeCast(), seed: 'underfoot' }, { population: 1, retireRadius: 500 })
    for (let frame = 0; frame < 60; frame++) crowd.update(STEP, middle)

    // the player plants themselves exactly where the walker is standing and does not move again
    const on = { ...crowd.walkers()[0]! }
    let escaped = -1
    let backInside = 0

    for (let frame = 0; frame < 600; frame++) {
      crowd.update(STEP, on)
      const gap = distance(crowd.walkers()[0]!, on)
      if (escaped === -1) {
        if (gap >= crowd.options.personalSpace) escaped = frame
      } else if (gap < crowd.options.personalSpace) backInside++
    }

    // out from under them within three seconds, walking away rather than shuffling against them
    expect(escaped).toBeGreaterThanOrEqual(0)
    expect(escaped).toBeLessThan(180)
    expect(backInside).toBe(0)
  })
})
