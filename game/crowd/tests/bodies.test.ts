import type { World } from '@gb/world'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { Crowd, SceneCast, type Cell, type Point } from '../src/index.ts'
import { StraightNav } from './support/fake-nav.ts'
import { StubCast } from './support/stub-cast.ts'
import { testTown } from './support/town.ts'

const STEP = 1 / 60
const EAST: Cell = { x: 1, y: 0 }

let world: World
let middle: Point

beforeAll(() => {
  world = testTown()
  middle = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
})

/** A crowd wearing real `@gb/cast` bodies, minus the art pack: the way the game stands it up. */
function street(population = 1, seed = 'bodies') {
  const root = new THREE.Object3D()
  const cast = new StubCast()
  const scene = new SceneCast(cast, root)
  const nav = new StraightNav(world.cellSize, 40, EAST)
  const crowd = Crowd.create({ world, nav, cast: scene, seed }, { population, pauseMax: 0 })
  const run = (frames: number, at: Point = middle): void => {
    for (let frame = 0; frame < frames; frame++) crowd.update(STEP, at)
  }
  return { crowd, scene, cast, root, run }
}

describe('the body behind a walker', () => {
  it('hands over the body of somebody out on the pavement, by their id', () => {
    const { crowd, scene, cast, run } = street()
    run(30)

    const walker = crowd.walkers()[0]!
    const member = scene.members().get(walker.id)
    // the body they are actually wearing, standing where they are standing
    expect(member).toBe(cast.members[0])
    expect(member!.object.position.x).toBeCloseTo(walker.x, 6)
    expect(member!.object.position.z).toBeCloseTo(walker.z, 6)
  })

  it('forgets whoever has gone home, and answers for everybody who is out', () => {
    const { crowd, scene, run } = street(4)
    run(60)
    const before = crowd.walkers().map((walker) => walker.id)
    expect(before.length).toBeGreaterThan(0)

    // the player leaves the whole street behind
    run(1, { x: middle.x + 900, z: middle.z })
    expect(crowd.count).toBe(0)
    for (const id of before) expect(scene.members().get(id)).toBeUndefined()

    // and comes back to a pavement with other people on it
    run(60)
    expect(crowd.count).toBeGreaterThan(0)
    for (const walker of crowd.walkers()) expect(scene.members().get(walker.id)).toBeDefined()
    expect(scene.members().size).toBe(crowd.count)
    for (const id of before) expect(scene.members().get(id)).toBeUndefined()
  })

  it('gives one body to somebody who leaves the pavement to walk with the player', () => {
    const { crowd, scene, cast, root, run } = street()
    run(30)
    const walker = crowd.walkers()[0]!
    const npc = crowd.person(walker.id)!

    crowd.follow({ npc, at: { x: walker.x, z: walker.z } })

    expect(crowd.walkers().some((out) => out.id === npc.id)).toBe(false)
    expect(crowd.following().map((out) => out.id)).toEqual([npc.id])
    // one person, one body: the one they were already wearing, not a second skeleton
    expect(root.children.length).toBe(1)
    expect(cast.spawned.length).toBe(1)
    expect(scene.members().get(npc.id)).toBe(cast.members[0])
  })
})
