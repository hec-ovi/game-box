import { CityNav } from '@gb/nav'
import { METRICS, type Npc, type World } from '@gb/world'
import { beforeAll, describe, expect, it } from 'vitest'
import { Crowd, type Point } from '../src/index.ts'
import { Country } from './support/country.ts'
import { FakeCast } from './support/fake-cast.ts'
import { testTown } from './support/town.ts'

const STEP = 1 / 60

let world: World
let nav: CityNav
let middle: Point

beforeAll(() => {
  world = testTown()
  nav = CityNav.from(world)
  middle = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
})

function guide(name: string): Npc {
  return {
    id: `npc_${name}`,
    name,
    role: 'wanderer',
    appearance: { base: 'female', variant: 3 },
    personality: 'Comes along.',
    knowledge: [],
  }
}

function party(count = 1, options = {}) {
  const cast = new FakeCast()
  const crowd = Crowd.create({ world, nav, cast, seed: 'party' }, { population: 0, ...options })
  crowd.update(STEP, middle)
  for (let i = 0; i < count; i++) crowd.follow({ npc: guide(`friend${i}`), at: { x: middle.x + 1 + i, z: middle.z } })
  return { crowd, cast }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** Walk the player along the pavement row through the middle of town, at whatever pace. */
function stroll(crowd: Crowd, speed: number, frames: number, at: { x: number; z: number }) {
  const seen: { gap: number; where: Point }[] = []
  for (let frame = 0; frame < frames; frame++) {
    at.x += speed * STEP
    crowd.update(STEP, at)
    const companion = crowd.following()[0]
    if (companion) seen.push({ gap: distance(companion, at), where: { x: companion.x, z: companion.z } })
  }
  return seen
}

describe('companions', () => {
  it('comes along, keeps its distance, and stops when the player stops', () => {
    const { crowd } = party()
    const at = { x: middle.x, z: middle.z }

    const walking = stroll(crowd, METRICS.player.walkSpeed, 900, at)
    expect(walking.length).toBe(900)
    // never underfoot, never left behind
    for (const step of walking.slice(120)) {
      expect(step.gap).toBeGreaterThanOrEqual(crowd.options.personalSpace - 1e-9)
      expect(step.gap).toBeLessThan(6)
    }

    // the player stops: they settle behind and stay put
    const standing = stroll(crowd, 0, 300, at)
    const last = standing[standing.length - 1]!
    expect(last.gap).toBeLessThan(crowd.options.followGap + 1)
    const settled = standing.slice(-60)
    for (const step of settled) expect(distance(step.where, last.where)).toBeLessThan(0.5)
  })

  it('breaks into a run to catch up, and closes the gap after a sprint', () => {
    const { crowd } = party()
    const at = { x: middle.x, z: middle.z }
    stroll(crowd, METRICS.player.walkSpeed, 120, at)

    const sprint = stroll(crowd, METRICS.player.runSpeed, 240, at)
    expect(sprint.length).toBe(240)
    const worst = Math.max(...sprint.map((step) => step.gap))
    // it loses ground on a runner, but not the plot
    expect(worst).toBeLessThan(crowd.options.lostRadius)
    expect(sprint.some((step) => step.gap > crowd.options.catchUp)).toBe(true)

    const after = stroll(crowd, 0, 600, at)
    expect(after[after.length - 1]!.gap).toBeLessThan(crowd.options.followGap + 1)
  })

  it('is put back beside the player only when it has lost them completely', () => {
    const { crowd } = party()
    const at = { x: middle.x, z: middle.z }
    stroll(crowd, METRICS.player.walkSpeed, 120, at)

    // the player is suddenly the other side of town, which is what coming out of a building looks like
    at.x = middle.x + 40
    crowd.update(STEP, at)
    crowd.update(STEP, at)
    expect(distance(crowd.following()[0]!, at)).toBeLessThanOrEqual(crowd.options.followGap + 1e-9)
  })

  it('two of them walk beside each other rather than in each other', () => {
    const { crowd } = party(2)
    const at = { x: middle.x, z: middle.z }
    stroll(crowd, METRICS.player.walkSpeed, 900, at)

    for (let frame = 0; frame < 600; frame++) {
      at.x += METRICS.player.walkSpeed * STEP
      crowd.update(STEP, at)
      const [one, two] = crowd.following()
      expect(distance(one!, two!)).toBeGreaterThanOrEqual(crowd.options.personalSpace - 1e-9)
      expect(distance(one!, at)).toBeLessThan(6)
      expect(distance(two!, at)).toBeLessThan(6)
    }
  })

  it('goes round a building the player walks round, and never through it', () => {
    const { crowd } = party()
    const at = { x: 50, z: 55 }
    crowd.update(STEP, at)
    let inside = 0

    const watch = () => {
      const companion = crowd.following()[0]!
      const kind = world.grid.at(Math.floor(companion.x / world.cellSize), Math.floor(companion.z / world.cellSize))
      if (kind === 'building' || kind === 'water' || kind === 'mountain') inside++
    }

    // east along the pavement, then south round the corner of the block, so the building comes between them
    for (let frame = 0; frame < 900; frame++) {
      at.x += METRICS.player.walkSpeed * STEP
      crowd.update(STEP, at)
      watch()
    }
    for (let frame = 0; frame < 900; frame++) {
      at.z += METRICS.player.walkSpeed * STEP
      crowd.update(STEP, at)
      watch()
    }
    for (let frame = 0; frame < 300; frame++) {
      crowd.update(STEP, at)
      watch()
    }

    expect(inside).toBe(0)
    expect(distance(crowd.following()[0]!, at)).toBeLessThan(crowd.options.followGap + 1)
  })

  it('is listed while it follows, and hands its body back when it stops', () => {
    const { crowd, cast } = party()
    expect(crowd.following().map((view) => view.id)).toEqual(['npc_friend0'])
    expect(cast.live.length).toBe(1)

    // following twice is following once
    crowd.follow({ npc: guide('friend0'), at: middle })
    expect(crowd.following().length).toBe(1)

    crowd.stopFollowing('npc_friend0')
    expect(crowd.following()).toEqual([])
    expect(cast.live).toEqual([])
  })

  it('follows the player out of town on the ground the game gave it, and never lands on their face', () => {
    const cast = new FakeCast()
    const edge = world.grid.width * world.cellSize
    const country = new Country(edge)
    const crowd = Crowd.create({ world, nav, cast, ground: country, seed: 'party' }, { population: 0 })
    const at = { x: middle.x, z: middle.z }
    crowd.update(STEP, at)
    crowd.follow({ npc: guide('friend0'), at: { x: middle.x + 1, z: middle.z } })

    const body = cast.made[0]!
    let where = { x: body.x, z: body.z }
    let teleports = 0
    let offTheGround = 0
    let worst = 0
    // 200 m east, out of the city and down the slope beyond it
    for (let frame = 0; frame < 60 * 210; frame++) {
      at.x += METRICS.player.walkSpeed * STEP
      crowd.update(STEP, at)
      if (Math.hypot(body.x - where.x, body.z - where.z) > METRICS.player.runSpeed * STEP + 1e-6) teleports++
      where = { x: body.x, z: body.z }
      // feet on the ground the game gave us, plus the kerb while they are still on the pavement
      const under = world.grid.at(Math.floor(body.x / world.cellSize), Math.floor(body.z / world.cellSize))
      const kerb = under === 'sidewalk' || under === 'park' ? crowd.options.kerbHeight : 0
      if (Math.abs(body.y - (country.heightAt(body.x, body.z) + kerb)) > 1e-9) offTheGround++
      worst = Math.max(worst, distance(crowd.following()[0]!, at))
    }

    expect(at.x - edge).toBeGreaterThan(200)
    expect(teleports).toBe(0)
    expect(offTheGround).toBe(0)
    expect(worst).toBeLessThan(crowd.options.lostRadius)
    expect(distance(crowd.following()[0]!, at)).toBeLessThan(crowd.options.followGap + 1)
  })

  it('stands still rather than stepping inside the player when there is nowhere to put it', () => {
    const cast = new FakeCast()
    const edge = world.grid.width * world.cellSize
    // a landscape nobody may stand in: past the edge of the map there is nowhere for a companion to be
    const crowd = Crowd.create(
      { world, nav, cast, ground: new Country(edge, { walkable: false }), seed: 'party' },
      { population: 0 },
    )
    const at = { x: edge - 8, z: middle.z }
    crowd.update(STEP, at)
    crowd.follow({ npc: guide('friend0'), at: { x: at.x - 1, z: at.z } })

    let closest = Infinity
    for (let frame = 0; frame < 60 * 60; frame++) {
      at.x += METRICS.player.walkSpeed * STEP
      crowd.update(STEP, at)
      closest = Math.min(closest, distance(crowd.following()[0]!, at))
    }

    // the player walked off the map and kept going; the companion held the last ground it had
    expect(at.x).toBeGreaterThan(edge + 60)
    expect(closest).toBeGreaterThanOrEqual(crowd.options.personalSpace)
    const standing = crowd.following()[0]!
    expect(standing.x).toBeLessThan(edge)
    expect(standing.state).toBe('idle')
  })

  it('leaves a body the game handed over alone when it stops following', () => {
    const cast = new FakeCast()
    const crowd = Crowd.create({ world, nav, cast, seed: 'party' }, { population: 0 })
    const actor = cast.spawn(guide('borrowed'))
    crowd.follow({ npc: guide('borrowed'), at: middle, actor })

    crowd.stopFollowing('npc_borrowed')
    expect(cast.made.length).toBe(1)
    expect(cast.live.length).toBe(1)
  })
})
