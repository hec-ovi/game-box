import { CLIPS, clipsUsed, WALKS, walkFor } from '@gb/cast'
import { CityNav } from '@gb/nav'
import { cellCentre, METRICS, World, type CellKind, type Npc } from '@gb/world'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { Crowd, SceneCast, type CrowdOptions, type CrowdPeople, type Point, type WalkerView } from '../src/index.ts'
import { FakeCast } from './support/fake-cast.ts'
import { StubCast } from './support/stub-cast.ts'
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
    const { crowd } = crowdOf({ population: 1, tripMin: 10, tripMax: 20, pauseMin: 2, pauseMax: 3, dwellMin: 2, dwellMax: 3 })
    let arrivals = 0
    let wasWalking = false

    for (let frame = 0; frame < 3600; frame++) {
      crowd.update(STEP, middle)
      const walker = crowd.walkers()[0]
      if (!walker) continue
      if (wasWalking && walker.state === 'idle') {
        arrivals++
        expect(walker.remaining).toBe(0)
      }
      wasWalking = walker.state === 'walking'
    }

    // two arrivals means they set off again after the first, which is the whole cycle
    expect(arrivals).toBeGreaterThanOrEqual(2)
  })

  it('is going somewhere: the door of a building in town, and stands at it before moving on', () => {
    const { crowd } = crowdOf({ population: 4, dwellMin: 1, dwellMax: 2 })
    const doors = new Map<string, Point>()
    for (const plot of world.plotsOfKind('house')) {
      doors.set(plot.id, cellCentre(plot.entrance.cell.x, plot.entrance.cell.y, world.cellSize))
    }
    let heading = 0
    let stood = 0

    for (let frame = 0; frame < 3600; frame++) {
      crowd.update(STEP, middle)
      for (const walker of crowd.walkers()) {
        const going = crowd.destination(walker.id)
        if (walker.state !== 'idle') {
          // on the move, it is towards a door in this town, and not one they are standing at yet
          expect(going).toBeDefined()
          expect(doors.has(going!.plotId)).toBe(true)
          expect(going!.arrived).toBe(false)
          heading++
        } else if (going?.arrived) {
          expect(distance(walker, doors.get(going.plotId)!)).toBeLessThanOrEqual(1 + 1e-9)
          stood++
        }
      }
    }

    expect(heading).toBeGreaterThan(0)
    expect(stood).toBeGreaterThan(0)
    expect(crowd.destination('npc_nobody')).toBeUndefined()
  })

  it('goes to the doors of a kind of place only this city declares', () => {
    // a town of a word no preset ships: its charter is the only reason the word is legal
    const invented = testTown('roost')
    const doors = new Set(invented.plotsOfKind('roost').map((plot) => plot.id))
    expect(doors.size).toBeGreaterThan(0)
    const crowd = Crowd.create({ world: invented, nav: CityNav.from(invented), cast: new FakeCast(), seed: 'invented' }, { population: 4 })
    let heading = 0

    for (let frame = 0; frame < 600; frame++) {
      crowd.update(STEP, middle)
      for (const walker of crowd.walkers()) {
        const going = crowd.destination(walker.id)
        if (!going) continue
        expect(doors.has(going.plotId)).toBe(true)
        heading++
      }
    }

    expect(heading).toBeGreaterThan(0)
  })

  it('is always playing a clip the pack has, walks its own walk, and stands in an idle when it gets there', () => {
    const root = new THREE.Object3D()
    const cast = new StubCast()
    const crowd = Crowd.create(
      { world, nav, cast: new SceneCast(cast, root), seed: 'clips' },
      { population: 8, tripMin: 10, tripMax: 20 },
    )
    const library = new Set(clipsUsed())
    // a walker's id is the id of the person walking, which is the id their body was spawned under
    const bodyOf = (walker: WalkerView) => cast.members.find((member) => member.npcId === walker.id)
    const walks = new Set<string>()
    let standing = 0

    for (let frame = 0; frame < 2400; frame++) {
      crowd.update(STEP, middle)
      for (const walker of crowd.walkers()) {
        const playing = bodyOf(walker)?.playing
        // never the rest pose: from the frame they appear there is a real clip on the body
        expect(playing !== undefined && library.has(playing)).toBe(true)
        // the walk is the one the cast draws off their id, so the same person always walks the same way
        expect(playing).toBe(walker.state === 'walking' ? walkFor(walker.id) : CLIPS.idle)
        if (walker.state === 'idle') standing++
        else walks.add(playing!)
      }
    }

    expect(standing).toBeGreaterThan(0)
    // a populated street is not in step: more than one of the cast's walks is playing on it
    for (const walk of walks) expect(WALKS).toContain(walk)
    expect(walks.size).toBeGreaterThanOrEqual(2)
  })

  it('paces the walk to the speed the body really covers, and only while walking', () => {
    const { crowd, cast } = crowdOf({ population: 4, tripMin: 10, tripMax: 20 }, 'pace')
    const before = new Map<string, WalkerView>()
    let paced = 0

    for (let frame = 0; frame < 1200; frame++) {
      const asked = cast.made.map((actor) => actor.paces.length)
      crowd.update(STEP, middle)
      for (const walker of crowd.walkers()) {
        const actor = cast.live.find((body) => body.npc.id === walker.id)!
        const index = cast.made.indexOf(actor)
        const calls = actor.paces.length - (asked[index] ?? 0)
        const previous = before.get(walker.id)
        before.set(walker.id, walker)
        // standing, waiting at a kerb or just arrived: nothing to pace this frame
        if (walker.state !== 'walking') expect(calls).toBe(0)
        if (walker.state !== 'walking' || previous?.state !== 'walking') continue
        // one speed a frame, and it is the ground the feet covered, not the pace they set out at
        expect(calls).toBe(1)
        expect(actor.paces.at(-1)).toBeCloseTo(distance(previous, walker) / STEP, 6)
        paced++
      }
    }

    expect(paced).toBeGreaterThan(0)
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

  it('is the same crowd from the same seed, down to the last step', () => {
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
  })

  it('is walked by people the game can ask about, one id each', () => {
    const { crowd, cast } = crowdOf({ population: 6 })
    for (let i = 0; i < 300; i++) crowd.update(STEP, middle)

    const walkers = crowd.walkers()
    expect(walkers.length).toBe(6)
    for (const walker of walkers) {
      const who = crowd.person(walker.id)
      expect(who?.id).toBe(walker.id)
      // the body on the street is that person's body, not somebody else's
      expect(cast.live.some((actor) => actor.npc.id === walker.id)).toBe(true)
    }
    expect(new Set(walkers.map((walker) => walker.id)).size).toBe(6)
    expect(crowd.person('npc_nobody')).toBeUndefined()
  })

  it('walks the city its own people when the game hands them over, and nobody twice at once', () => {
    const residents: Npc[] = Array.from({ length: 5 }, (_, i) => ({
      id: `npc_${i + 1}`,
      name: `Resident ${i + 1}`,
      role: 'resident',
      appearance: { base: 'male', variant: i },
      personality: 'Lives here.',
      knowledge: [],
    }))
    // the game's own people, offered round and round: the crowd must not put one out twice
    const people: CrowdPeople = { street: (serial) => residents[serial % residents.length] }
    const cast = new FakeCast()
    const crowd = Crowd.create({ world, nav, cast, people, seed: 'residents' }, { population: 8 })

    for (let i = 0; i < 300; i++) crowd.update(STEP, middle)

    const walkers = crowd.walkers()
    expect(walkers.length).toBe(residents.length)
    expect(walkers.map((walker) => walker.id).sort()).toEqual(residents.map((who) => who.id).sort())
    for (const walker of walkers) expect(crowd.person(walker.id)?.name).toBe(`Resident ${walker.id.slice(4)}`)
  })

  it('finds nobody to walk in a city with no pavement, and says so by staying empty', () => {
    const bare = World.create({ name: 'Nowhere', theme: 'empty', seed: 'bare', width: 16, height: 16 })
    const crowd = Crowd.create({ world: bare, nav: CityNav.from(bare), cast: new FakeCast(), seed: 'bare' })

    for (let i = 0; i < 60; i++) crowd.update(STEP, { x: 16, z: 16 })
    expect(crowd.count).toBe(0)
    expect(crowd.walkers()).toEqual([])
  })
})
