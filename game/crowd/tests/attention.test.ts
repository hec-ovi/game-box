import { CLIPS } from '@gb/cast'
import { CityNav } from '@gb/nav'
import type { Npc, World } from '@gb/world'
import { beforeAll, describe, expect, it } from 'vitest'
import { HEAD_TURN } from '../src/attention.ts'
import { Crowd, type Cell, type Point, type WalkerView } from '../src/index.ts'
import { FakeActor, FakeCast } from './support/fake-cast.ts'
import { StraightNav } from './support/fake-nav.ts'
import { testTown } from './support/town.ts'

const STEP = 1 / 60
const EAST: Cell = { x: 1, y: 0 }

let world: World
let middle: Point

beforeAll(() => {
  world = testTown()
  middle = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
})

/** One walker on a long straight leg, already walking it, with the body they are driving. */
function oneWalker(seed = 'attention') {
  const cast = new FakeCast()
  const nav = new StraightNav(world.cellSize, 40, EAST)
  const asked: Cell[] = []
  const routes = nav.path.bind(nav)
  nav.path = (from: Cell) => {
    asked.push(from)
    return routes(from)
  }

  const crowd = Crowd.create({ world, nav, cast, seed }, { population: 1, retireRadius: 500, pauseMax: 0 })
  let walker: WalkerView | undefined
  for (let frame = 0; frame < 240 && walker?.state !== 'walking'; frame++) {
    crowd.update(STEP, middle)
    walker = crowd.walkers()[0]
  }
  // walking, and long enough into it to be facing the way they are going
  for (let frame = 0; frame < 30; frame++) crowd.update(STEP, middle)
  walker = crowd.walkers()[0]
  if (!walker || walker.state !== 'walking') throw new Error('nobody came out to walk')
  return { crowd, cast, actor: cast.made[0]!, asked, walker }
}

/** Where the player stands to talk to somebody: two metres off, at eye height. */
function facing(walker: { x: number; z: number }, away: { x: number; z: number }) {
  return { x: walker.x + away.x * 2, y: 1.7, z: walker.z + away.z * 2 }
}

/** How far the point somebody is looking at is off their own front, in radians. */
function offTheirFront(actor: FakeActor, look: { x: number; z: number }): number {
  const dx = look.x - actor.x
  const dz = look.z - actor.z
  const away = Math.hypot(dx, dz)
  const dot = (dx / away) * -Math.sin(actor.heading) + (dz / away) * -Math.cos(actor.heading)
  return Math.acos(Math.min(Math.max(dot, -1), 1))
}

describe('somebody being talked to', () => {
  it('stops where they were walking and comes round to face whoever it is', () => {
    const { crowd, actor, walker } = oneWalker()
    const stood = { x: walker.x, z: walker.z }
    const player = facing(walker, { x: 0, z: -1 })

    const hold = crowd.attend(walker.id, player.x, player.y, player.z)
    expect(hold.held).toBe(true)
    for (let frame = 0; frame < 120; frame++) crowd.update(STEP, middle)

    const held = crowd.walkers()[0]!
    expect(Math.hypot(held.x - stood.x, held.z - stood.z)).toBeLessThan(0.02)
    expect(held.state).toBe('idle')
    expect(actor.clip).toBe(CLIPS.idle)
    // the player is due north of them, and north is a heading of zero
    expect(held.heading).toBeCloseTo(0, 2)
  })

  it('turns like a person rather than snapping round like a turret', () => {
    const { crowd, walker } = oneWalker()
    // straight behind them: the whole way round, which is where a snap would show
    const player = facing(walker, { x: -1, z: 0 })
    const before = crowd.walkers()[0]!.heading

    crowd.attend(walker.id, player.x, player.y, player.z)
    crowd.update(STEP, middle)
    const afterOne = Math.abs(crowd.walkers()[0]!.heading - before)
    expect(afterOne).toBeGreaterThan(0)
    expect(afterOne).toBeLessThan(0.1)

    // and it is a turn, not a crawl: a second and a half is long enough to have arrived
    for (let frame = 0; frame < 90; frame++) crowd.update(STEP, middle)
    const held = crowd.walkers()[0]!
    expect(Math.abs(held.heading - Math.PI / 2)).toBeLessThan(0.05)
  })

  it('never swivels its head further than a head turns, and looks straight at them once round', () => {
    const { crowd, actor, walker } = oneWalker()
    const player = facing(walker, { x: -1, z: 0 })

    crowd.attend(walker.id, player.x, player.y, player.z)
    // read the head against the body it is turning on, the frame it was asked for
    const watched: { off: number; y: number }[] = []
    for (let frame = 0; frame < 120; frame++) {
      crowd.update(STEP, middle)
      const look = actor.looks[actor.looks.length - 1]!
      watched.push({ off: offTheirFront(actor, look), y: look.y })
    }

    expect(watched.length).toBeGreaterThan(100)
    let widest = 0
    for (const look of watched) widest = Math.max(widest, look.off)
    // this only proves the clamp while the body really was left behind by the head
    expect(widest).toBeLessThanOrEqual(HEAD_TURN + 1e-9)
    expect(widest).toBeGreaterThan(HEAD_TURN - 1e-9)
    // the head is at their eyes, not at their feet
    expect(watched[0]!.y).toBeCloseTo(player.y, 6)
    // once the body is round, the head is straight at them rather than held off to one side
    expect(watched[watched.length - 1]!.off).toBeLessThan(0.05)
  })

  it('comes round and walks on where they were going once they are let go', () => {
    const { crowd, actor, asked, walker } = oneWalker()
    const player = facing(walker, { x: 0, z: -1 })
    const hold = crowd.attend(walker.id, player.x, player.y, player.z)
    for (let frame = 0; frame < 60; frame++) crowd.update(STEP, middle)

    const stood = crowd.walkers()[0]!
    const routes = asked.length
    hold.release()
    expect(hold.held).toBe(false)
    expect(actor.looksAway).toBe(1)

    for (let frame = 0; frame < 5; frame++) crowd.update(STEP, middle)
    // they turn back before they set off, rather than sliding off sideways
    expect(Math.hypot(crowd.walkers()[0]!.x - stood.x, crowd.walkers()[0]!.z - stood.z)).toBeLessThan(0.05)

    for (let frame = 0; frame < 120; frame++) crowd.update(STEP, middle)
    const walking = crowd.walkers()[0]!
    expect(walking.state).toBe('walking')
    expect(walking.x - stood.x).toBeGreaterThan(1)
    expect(walking.remaining).toBeLessThan(stood.remaining)
    // the route they had is the route they are on: nobody had to ask the city for another
    expect(asked.length).toBe(routes)
  })

  it('holds nobody when nobody by that id is out here', () => {
    const { crowd } = oneWalker()
    const hold = crowd.attend('npc_nobody', 0, 1.7, 0)
    expect(hold.held).toBe(false)
    expect(() => {
      hold.face(1, 1.7, 1)
      hold.release()
    }).not.toThrow()
  })

  it('lets go by itself when the person is retired while the hold is still open', () => {
    const { crowd, actor, walker } = oneWalker()
    const player = facing(walker, { x: 0, z: -1 })
    const hold = crowd.attend(walker.id, player.x, player.y, player.z)
    crowd.update(STEP, middle)

    // the player leaves them behind: they go home mid-conversation
    const away = { x: middle.x + 900, z: middle.z }
    crowd.update(STEP, away)
    expect(actor.released).toBe(true)
    expect(hold.held).toBe(false)
    expect(() => {
      hold.face(player.x, player.y, player.z)
      hold.release()
    }).not.toThrow()
  })
})

describe('a companion being talked to', () => {
  const friend: Npc = {
    id: 'npc_friend',
    name: 'Friend',
    role: 'wanderer',
    appearance: { base: 'female', variant: 2 },
    personality: 'Comes along.',
    knowledge: [],
  }

  it('stops keeping up, faces the player, and catches up again after', () => {
    const cast = new FakeCast()
    const crowd = Crowd.create({ world, nav: CityNav.from(world), cast, seed: 'talking-companion' }, { population: 0 })
    const at = { x: middle.x, z: middle.z }
    crowd.update(STEP, at)
    crowd.follow({ npc: friend, at: { x: at.x + 1, z: at.z } })

    // walk a few metres so they are following rather than standing where they started
    for (let frame = 0; frame < 120; frame++) {
      at.x += 1.4 * STEP
      crowd.update(STEP, at)
    }

    const stood = crowd.following()[0]!
    const hold = crowd.attend(friend.id, at.x, 1.7, at.z)
    expect(hold.held).toBe(true)
    for (let frame = 0; frame < 90; frame++) {
      hold.face(at.x, 1.7, at.z)
      crowd.update(STEP, at)
    }

    const held = crowd.following()[0]!
    expect(Math.hypot(held.x - stood.x, held.z - stood.z)).toBeLessThan(0.05)
    const toPlayer = Math.atan2(-(at.x - held.x), -(at.z - held.z))
    expect(Math.abs(held.heading - toPlayer)).toBeLessThan(0.05)

    hold.release()
    for (let frame = 0; frame < 180; frame++) {
      at.x += 1.4 * STEP
      crowd.update(STEP, at)
    }
    const back = crowd.following()[0]!
    expect(Math.hypot(back.x - at.x, back.z - at.z)).toBeLessThan(crowd.options.catchUp)
  })
})
