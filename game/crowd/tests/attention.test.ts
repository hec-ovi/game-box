import { CLIPS } from '@gb/cast'
import { CityNav } from '@gb/nav'
import { METRICS, WIDEST_ROADWAY_CELLS, type Npc, type World } from '@gb/world'
import { beforeAll, describe, expect, it } from 'vitest'
import { HEAD_TURN } from '../src/attention.ts'
import { Crowd, Leash, type Cell, type Point, type WalkerView } from '../src/index.ts'
import { FakeActor, FakeCast } from './support/fake-cast.ts'
import { StraightNav } from './support/fake-nav.ts'
import { testTown, wideRoad } from './support/town.ts'

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

/** True where this point is out in a roadway, read off the town rather than off anything the crowd built. */
function inTheRoad(at: { x: number; z: number }, town: World = world): boolean {
  return town.grid.at(Math.floor(at.x / town.cellSize), Math.floor(at.z / town.cellSize)) === 'street'
}

/**
 * True where somebody walking east is part way over a crossing: roadway under
 * their feet and the far kerb a couple of cells ahead. Worked out from the town
 * rather than from the crowd, so a test using it is not asking the crowd to
 * mark its own homework.
 */
function partWayOver(at: { x: number; z: number }): boolean {
  return inTheRoad(at) && !inTheRoad({ x: at.x + 2 * world.cellSize, z: at.z })
}

/** One walker taken out into a roadway, part way over it, walking to the far kerb. */
function outInTheRoad(seed = 'crossing') {
  const one = oneWalker(seed)
  let walker = one.walker
  for (let frame = 0; frame < 1800 && !partWayOver(walker); frame++) {
    one.crowd.update(STEP, middle)
    walker = one.crowd.walkers()[0]!
  }
  if (!partWayOver(walker)) throw new Error('nobody was caught part way over a crossing')
  return { ...one, walker }
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

  it('finishes the crossing it is out in the middle of, and turns on the far kerb', () => {
    const { crowd, actor, walker } = outInTheRoad()
    const player = facing(walker, { x: 0, z: -1 })

    // the hold is taken the moment it is asked for: what waits is the turning
    const hold = crowd.attend(walker.id, player.x, player.y, player.z)
    expect(hold.held).toBe(true)

    let stopped: WalkerView | undefined
    for (let frame = 0; frame < 300 && !stopped; frame++) {
      hold.face(player.x, player.y, player.z)
      crowd.update(STEP, middle)
      const now = crowd.walkers()[0]!
      // out in the road they are still walking it, not standing in front of the traffic
      if (now.state === 'idle') stopped = now
      else expect(actor.clip).toBe(CLIPS.walk)
    }

    expect(stopped).toBeDefined()
    expect(inTheRoad(stopped!)).toBe(false)
    expect(Math.hypot(stopped!.x - walker.x, stopped!.z - walker.z)).toBeGreaterThan(0.5)

    // and on the kerb they come round to the player the way anybody standing still does
    for (let frame = 0; frame < 120; frame++) {
      hold.face(player.x, player.y, player.z)
      crowd.update(STEP, middle)
    }
    const held = crowd.walkers()[0]!
    const toPlayer = Math.atan2(-(player.x - held.x), -(player.z - held.z))
    expect(Math.abs(held.heading - toPlayer)).toBeLessThan(0.05)
    expect(actor.clip).toBe(CLIPS.idle)
  })

  it('is left walking, not turning to nobody at the kerb, when they are let go before they are over', () => {
    const { crowd, actor, asked, walker } = outInTheRoad('let-go-crossing')
    const player = facing(walker, { x: 0, z: -1 })
    const hold = crowd.attend(walker.id, player.x, player.y, player.z)
    const routes = asked.length

    // the player walks off while they are still out in the road
    crowd.update(STEP, middle)
    hold.release()
    expect(hold.held).toBe(false)

    let over = -1
    for (let frame = 0; frame < 240; frame++) {
      crowd.update(STEP, middle)
      const now = crowd.walkers()[0]!
      if (over === -1 && !inTheRoad(now)) {
        over = frame
        // they walked onto the kerb and kept going, rather than stopping to face nobody
        expect(now.state).toBe('walking')
      }
    }

    expect(over).toBeGreaterThanOrEqual(0)
    // they never stood, so they never looked at anybody and never had to be sent anywhere new
    expect(actor.looksAway).toBe(0)
    expect(asked.length).toBe(routes)
  })

  it('stops where it stands when it is walking along a road rather than over one', () => {
    const town = wideRoad()
    const cell = town.cellSize
    const nav = new StraightNav(cell, 30, EAST)
    const viewer: Point = { x: cell * 0.5, z: cell * 1.5 }
    const crowd = Crowd.create(
      { world: town, nav, cast: new FakeCast(), seed: 'down-the-road' },
      { population: 1, retireRadius: 500, pauseMax: 0, spawnNear: 2, spawnFar: 8 },
    )

    let walker: WalkerView | undefined
    for (let frame = 0; frame < 1800; frame++) {
      crowd.update(STEP, viewer)
      walker = crowd.walkers()[0]
      if (walker && inTheRoad(walker, town)) break
    }
    if (!walker || !inTheRoad(walker, town)) throw new Error('nobody walked out into the road')
    // the road runs on past anything a crossing can be, so there is no far kerb to wait for
    expect(inTheRoad({ x: walker.x + WIDEST_ROADWAY_CELLS * cell, z: walker.z }, town)).toBe(true)

    crowd.attend(walker.id, walker.x, 1.7, walker.z - 2)
    crowd.update(STEP, viewer)

    const held = crowd.walkers()[0]!
    expect(held.state).toBe('idle')
    expect(Math.hypot(held.x - walker.x, held.z - walker.z)).toBeLessThan(0.05)
  })

  it('lets go by itself when the player walks away from them', () => {
    const { crowd, actor, walker } = oneWalker('walk-away')
    // two metres off, and standing there long enough for the hold to be a conversation
    const player = { x: walker.x, z: walker.z - 2 }
    const hold = crowd.attend(walker.id, player.x, 1.7, player.z)
    for (let frame = 0; frame < 60; frame++) {
      hold.face(player.x, 1.7, player.z)
      crowd.update(STEP, player)
    }
    expect(hold.held).toBe(true)

    // then walking off up the road
    let ended = -1
    let apart = 0
    for (let frame = 0; frame < 600 && ended < 0; frame++) {
      player.z -= METRICS.player.walkSpeed * STEP
      hold.face(player.x, 1.7, player.z)
      crowd.update(STEP, player)
      if (!hold.held) {
        ended = frame
        const now = crowd.walkers()[0]!
        apart = Math.hypot(now.x - player.x, now.z - player.z)
      }
    }

    // over the moment the player is past talking distance, and they go on their way
    expect(ended).toBeGreaterThan(0)
    expect(apart).toBeGreaterThan(crowd.options.talkRadius)
    expect(apart).toBeLessThan(crowd.options.talkRadius + 0.1)
    expect(actor.looksAway).toBe(1)
    for (let frame = 0; frame < 120; frame++) crowd.update(STEP, player)
    expect(crowd.walkers()[0]!.state).toBe('walking')
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

describe('the range rule, for somebody who is nobody\'s walker', () => {
  it('is over once the player has come close and gone again, and not before', () => {
    const leash = new Leash(5)
    // never came close: a hold taken across the road stands while they walk over
    expect(leash.gone(12, 0)).toBe(false)
    expect(leash.gone(3, 4)).toBe(false)
    expect(leash.gone(0, 6)).toBe(true)
    leash.reset()
    expect(leash.gone(0, 6)).toBe(false)
  })
})
