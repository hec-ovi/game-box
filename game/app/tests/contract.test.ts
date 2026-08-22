import { METRICS } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { blocked, slide, step } from '../src/walk.ts'
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
    expect(highest).toBeGreaterThan(METRICS.player.eyeHeight + 0.5)
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
