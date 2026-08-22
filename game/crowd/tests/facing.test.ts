import type { World } from '@gb/world'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { Crowd, SceneCast, type Cell, type Point } from '../src/index.ts'
import { StraightNav } from './support/fake-nav.ts'
import { StubCast } from './support/stub-cast.ts'
import { testTown } from './support/town.ts'

const STEP = 1 / 60
const FRAMES = 300
/** Long enough for any turn to have finished: a walker swings round in half a second. */
const SETTLE = 60

/** Cell steps, so `y` is the grid axis that is world +Z. A sign error rarely survives all five. */
const WAYS: readonly { name: string; way: Cell }[] = [
  { name: 'north', way: { x: 0, y: -1 } },
  { name: 'south', way: { x: 0, y: 1 } },
  { name: 'east', way: { x: 1, y: 0 } },
  { name: 'west', way: { x: -1, y: 0 } },
  { name: 'north-east', way: { x: 1, y: -1 } },
]

interface Look {
  /** How far the point one metre in front of the body is from where the walker is going. */
  readonly ahead: number
  /** How far the body itself is. */
  readonly here: number
  readonly heading: number
  readonly travel: THREE.Vector3
}

let world: World
let middle: Point

beforeAll(() => {
  world = testTown()
  middle = { x: (world.grid.width * world.cellSize) / 2, z: (world.grid.height * world.cellSize) / 2 }
})

/** Walk one walker down a leg going this way, reading the body's own transform each frame. */
function march(way: Cell): Look[] {
  const root = new THREE.Object3D()
  const nav = new StraightNav(world.cellSize, 40, way)
  const crowd = Crowd.create(
    { world, nav, cast: new SceneCast(new StubCast(), root), seed: 'facing' },
    { population: 1, retireRadius: 500 },
  )

  const looks: Look[] = []
  let last: THREE.Vector3 | undefined

  for (let frame = 0; frame < FRAMES; frame++) {
    crowd.update(STEP, middle)
    const walker = crowd.walkers()[0]
    const body = root.children[0]
    const target = nav.destination
    if (!walker || !body || !target || walker.state !== 'walking') {
      last = undefined
      continue
    }
    root.updateMatrixWorld(true)
    const here = new THREE.Vector3(body.position.x, 0, body.position.z)
    // the body's own front, one metre along its -Z axis, in world space
    const ahead = body.localToWorld(new THREE.Vector3(0, 0, -1)).setY(0)
    const to = new THREE.Vector3(target.x, 0, target.z)
    if (frame >= SETTLE && last) {
      looks.push({
        ahead: ahead.distanceTo(to),
        here: here.distanceTo(to),
        heading: body.rotation.y,
        travel: here.clone().sub(last),
      })
    }
    last = here
  }
  return looks
}

describe('a walker faces the way it is walking', () => {
  for (const { name, way } of WAYS) {
    it(`going ${name}`, () => {
      const looks = march(way)
      expect(looks.length).toBeGreaterThan(150)

      const travelled = new THREE.Vector3()
      for (const look of looks) {
        // one step forward out of the body's own front takes it nearer where it is going, never further
        expect(look.ahead).toBeLessThan(look.here)
        // a straight leg, so the body is not swinging from side to side while it walks it
        expect(look.heading).toBeCloseTo(looks[0]!.heading, 9)
        travelled.add(look.travel)
      }

      // and it really did walk the way the test asked, or the rest proves nothing
      const wanted = new THREE.Vector3(way.x, 0, way.y).normalize()
      expect(travelled.length()).toBeGreaterThan(3)
      expect(travelled.normalize().dot(wanted)).toBeCloseTo(1, 6)
    })
  }
})
