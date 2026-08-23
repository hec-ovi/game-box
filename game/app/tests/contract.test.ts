// @vitest-environment node
import { PropFootprint } from '@gb/scene'
import { METRICS, type Interior } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { blocked, slide, step } from '../src/walk.ts'
import { alsoBlockedBy } from '../src/bodies.ts'
import { cityGround, citySolid, furnishedSolid } from '../src/solids.ts'
import { Body, CROUCH_EYE, JUMP_SPEED } from '../src/stance.ts'
import { CLOSE_FOV, WIDE_FOV, Zoom } from '../src/zoom.ts'

/** Everything from x = 4 east is wall. */
const wall = (x: number) => x >= 4

describe('walking', () => {
  it('goes the way the body is facing', () => {
    const north = step({ forward: 1, strafe: 0, running: false }, 0, 1)
    expect(north.z).toBeLessThan(0)
    expect(north.x).toBeCloseTo(0, 6)

    const east = step({ forward: 1, strafe: 0, running: false }, -Math.PI / 2, 1)
    expect(east.x).toBeGreaterThan(0)
    expect(east.z).toBeCloseTo(0, 6)
  })

  it('runs faster than it walks, and stands still when nothing is held', () => {
    const walked = step({ forward: 1, strafe: 0, running: false }, 0, 1)
    const ran = step({ forward: 1, strafe: 0, running: true }, 0, 1)
    expect(Math.abs(ran.z)).toBeGreaterThan(Math.abs(walked.z))
    expect(step({ forward: 0, strafe: 0, running: false }, 0, 1)).toEqual({ x: 0, z: 0 })
  })

  it('slides along a wall instead of stopping dead against it', () => {
    const moved = slide({ x: 3, z: 3 }, { x: 1, z: -1 }, wall)
    expect(moved.x).toBe(3)
    expect(moved.z).toBe(2)
  })

  it('counts a body as blocked when any of its sides is in something solid', () => {
    // the body has width: its centre is clear of the wall at 3.5, its side is not at 3.7
    expect(blocked(3.5, 0, wall)).toBe(false)
    expect(blocked(3.7, 0, wall)).toBe(true)
    expect(blocked(4.2, 0, wall)).toBe(true)
  })
})

describe('zoom', () => {
  it('eases in when the button is held and back out when it is let go', () => {
    const zoom = new Zoom()
    expect(zoom.fov).toBe(WIDE_FOV)

    zoom.close = true
    expect(zoom.update(1 / 60)).toBe(true)
    expect(zoom.fov).toBeLessThan(WIDE_FOV)
    expect(zoom.fov).toBeGreaterThan(CLOSE_FOV)

    for (let i = 0; i < 60; i++) zoom.update(1 / 60)
    expect(zoom.fov).toBe(CLOSE_FOV)
    expect(zoom.update(1 / 60)).toBe(false)

    zoom.close = false
    for (let i = 0; i < 60; i++) zoom.update(1 / 60)
    expect(zoom.fov).toBe(WIDE_FOV)
  })

  it('slows the mouse by as much as it narrowed the view', () => {
    const zoom = new Zoom()
    expect(zoom.lookScale).toBeCloseTo(1, 6)

    zoom.close = true
    for (let i = 0; i < 60; i++) zoom.update(1 / 60)
    expect(zoom.lookScale).toBeLessThan(0.85)
    expect(zoom.lookScale).toBeGreaterThan(0.6)
  })
})

describe('standing, crouching, jumping', () => {
  const settle = (body: Body, ground = 0, frames = 60) => {
    for (let i = 0; i < frames; i++) body.update(1 / 60, ground)
  }

  it('stands at eye height on flat ground', () => {
    const body = new Body()
    settle(body)
    expect(body.eye).toBeCloseTo(METRICS.player.eyeHeight, 5)
    expect(body.airborne).toBe(false)
    expect(body.speedScale).toBe(1)
  })

  it('crouches lower and slower, and stands back up', () => {
    const body = new Body()
    body.crouching = true
    settle(body)
    expect(body.eye).toBeCloseTo(CROUCH_EYE, 5)
    expect(body.speedScale).toBeLessThan(1)

    body.crouching = false
    settle(body)
    expect(body.eye).toBeCloseTo(METRICS.player.eyeHeight, 5)
  })

  it('comes down faster than it went up, so the jump has weight', () => {
    const body = new Body()
    settle(body)
    body.jump()

    let rising = 0
    let falling = 0
    let last = body.eye
    for (let i = 0; i < 200 && (body.airborne || i === 0); i++) {
      body.update(1 / 60, 0)
      if (body.eye > last) rising++
      else if (body.airborne) falling++
      last = body.eye
    }
    expect(rising).toBeGreaterThan(0)
    expect(falling).toBeGreaterThan(0)
    expect(falling).toBeLessThan(rising)
  })

  it('jumps up and comes back down to the ground it left', () => {
    const body = new Body()
    settle(body)
    body.jump()
    expect(body.airborne).toBe(true)

    let highest = body.eye
    for (let i = 0; i < 120; i++) {
      body.update(1 / 60, 0)
      highest = Math.max(highest, body.eye)
    }
    expect(highest).toBeGreaterThan(METRICS.player.eyeHeight + 0.8)
    expect(highest).toBeLessThan(METRICS.player.eyeHeight + 1.3)
    expect(body.eye).toBeCloseTo(METRICS.player.eyeHeight, 5)
    expect(body.airborne).toBe(false)
  })

  it('will not jump while crouched, or twice in the air', () => {
    const body = new Body()
    body.crouching = true
    settle(body)
    body.jump()
    expect(body.airborne).toBe(false)

    body.crouching = false
    settle(body)
    body.jump()
    body.update(1 / 60, 0)
    const rising = body.eye
    body.jump()
    body.update(1 / 60, 0)
    // the second press did not add to the first
    expect(body.eye - rising).toBeLessThan(JUMP_SPEED / 60)
  })

  it('steps up onto a kerb rather than through it', () => {
    const body = new Body()
    settle(body)
    const kerb = METRICS.street.curbHeight

    body.update(1 / 60, kerb)
    // it rises towards the step rather than snapping onto it
    expect(body.eye).toBeGreaterThan(METRICS.player.eyeHeight)
    expect(body.eye).toBeLessThan(METRICS.player.eyeHeight + kerb)

    settle(body, kerb)
    expect(body.eye).toBeCloseTo(METRICS.player.eyeHeight + kerb, 5)
  })
})

describe('bumping into people and cars', () => {
  const open: (x: number, z: number) => boolean = () => false

  it('stops the player walking through somebody', () => {
    const solid = alsoBlockedBy(open, () => [{ x: 10, z: 10 }])
    expect(solid(10, 10)).toBe(true)
    expect(solid(10.3, 10)).toBe(true)
    expect(solid(11, 10)).toBe(false)
  })

  it('lets the player slide past somebody rather than sticking to them', () => {
    const solid = alsoBlockedBy(open, () => [{ x: 10, z: 10 }])
    // walking straight at them, diagonally: the blocked axis stops, the other carries on
    const moved = slide({ x: 9.2, z: 10 }, { x: 0.4, z: 0.4 }, solid)
    expect(moved.x).toBe(9.2)
    expect(moved.z).toBeCloseTo(10.4, 5)
  })

  it('treats a car as the long thing it is, not as a circle', () => {
    // pointing down -Z, so it is long north to south and narrow east to west
    const solid = alsoBlockedBy(open, () => [], () => [{ x: 0, z: 0, heading: 0 }])
    expect(solid(0, 2)).toBe(true)
    expect(solid(0, 2.4)).toBe(false)
    expect(solid(1.2, 0)).toBe(false)
    expect(solid(0.8, 0)).toBe(true)
  })

  it('turns with the car', () => {
    // the same car turned a quarter turn is long east to west instead
    const solid = alsoBlockedBy(open, () => [], () => [{ x: 0, z: 0, heading: Math.PI / 2 }])
    expect(solid(2, 0)).toBe(true)
    expect(solid(0, 2)).toBe(false)
  })

  it('still respects the walls underneath', () => {
    const solid = alsoBlockedBy((x) => x > 5, () => [])
    expect(solid(6, 0)).toBe(true)
    expect(solid(4, 0)).toBe(false)
  })

  it('asks fresh every time, because everybody is moving', () => {
    let people = [{ x: 0, z: 0 }]
    const solid = alsoBlockedBy(open, () => people)
    expect(solid(0, 0)).toBe(true)
    people = []
    expect(solid(0, 0)).toBe(false)
  })
})

describe('leaving town', () => {
  const town = {
    cellSize: 2,
    grid: {
      at: (x: number, y: number) => {
        if (x < 0 || y < 0 || x > 3 || y > 3) return undefined
        return x === 1 && y === 1 ? ('building' as const) : ('street' as const)
      },
    },
  } as unknown as Parameters<typeof citySolid>[0]

  /** A hill outside town, with a cliff on one side of it. */
  const land = {
    heightAt: (x: number) => (x > 8 ? (x - 8) * 0.5 : 0),
    walkableAt: (x: number) => x < 30,
  }

  it('walls the world at the grid edge when there is no land', () => {
    const solid = citySolid(town)
    expect(solid(1, 1)).toBe(false)
    expect(solid(20, 1)).toBe(true)
  })

  it('lets the player walk out onto open country when there is', () => {
    const solid = citySolid(town, land)
    expect(solid(20, 1)).toBe(false)
    // and stops them where the land itself is not walkable
    expect(solid(40, 1)).toBe(true)
  })

  it('still stops them walking into a building', () => {
    expect(citySolid(town, land)(3, 3)).toBe(true)
  })

  it('stands them on the land outside and on the kerb inside', () => {
    const ground = cityGround(town, land)
    expect(ground(20, 1)).toBeCloseTo(6, 5)
    expect(ground(1, 1)).toBe(0)
  })
})

describe('furniture indoors', () => {
  // one room filling a 10x8 shell, no interior partitions to get in the way
  const room = { w: 10, h: 8 }
  const interior = {
    id: 'int_0001',
    size: room,
    rooms: [{ id: 'room_0001', kind: 'main', rect: { x: 0, y: 0, w: room.w, h: room.h } }],
    doors: [],
    furniture: [],
    anchors: [],
  } as unknown as Interior

  /** A table 1.2 m across and 0.8 m deep, standing in the middle of the floor. */
  function table(x: number, z: number, rot = 0): PropFootprint {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.8))
    mesh.geometry.translate(0, 0.375, 0)
    mesh.position.set(x, 0, z)
    mesh.rotation.y = rot
    mesh.updateMatrixWorld(true)
    return new PropFootprint('prop_0001', 'table', mesh)
  }

  it('stops the player walking through a table', () => {
    const solid = furnishedSolid(interior, [table(5, 4)])
    expect(solid(5, 4)).toBe(true)
    expect(solid(2, 2)).toBe(false)
  })

  it('still keeps the player inside the shell', () => {
    const bare = furnishedSolid(interior, [])
    const furnished = furnishedSolid(interior, [table(5, 4)])
    for (const at of [furnished, bare]) {
      expect(at(-0.5, 4)).toBe(true)
      expect(at(5, room.h + 0.5)).toBe(true)
    }
  })

  it('blocks along the way the table is turned, not the way the room is', () => {
    // the long side runs across x unturned, so a quarter turn swaps which axis is wide
    const straight = furnishedSolid(interior, [table(5, 4)])
    const turned = furnishedSolid(interior, [table(5, 4, Math.PI / 2)])
    expect(straight(5.5, 4)).toBe(true)
    expect(straight(5, 4.5)).toBe(false)
    expect(turned(5.5, 4)).toBe(false)
    expect(turned(5, 4.5)).toBe(true)
  })
})
