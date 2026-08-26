// @vitest-environment jsdom
import { GameClock } from '@gb/play'
import { World } from '@gb/world'
import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DAY, INDOORS, NIGHT } from '../src/night.ts'
import { Sky } from '../src/sky.ts'
import { Bench } from './support/bench.ts'

/** A town with ground under it, which is all the landscape needs to build. */
function town(): World {
  return World.create({ name: 'Lampwick', theme: 'neon downtown', seed: 'light', width: 30, height: 30 })
}

function skyOver(hour: number): { bench: Bench; sky: Sky; clock: GameClock } {
  const bench = new Bench(document.createElement('div'))
  const clock = GameClock.create()
  clock.setTime(hour)
  const sky = new Sky(town(), bench, { hour, weather: clock.weather })
  return { bench, sky, clock }
}

/** The hemisphere the landscape writes for the hour: the light the sky throws. */
function skyLight(bench: Bench): THREE.HemisphereLight {
  return bench.scene.getObjectByName('land:skylight') as THREE.HemisphereLight
}

function at(input: { bench: Bench; sky: Sky; clock: GameClock }, hour: number, outdoors = true): void {
  input.clock.setTime(Math.floor(hour), Math.round((hour % 1) * 60))
  input.sky.follow(1 / 60, input.clock, outdoors)
}

describe('what lights the city', () => {
  it('leaves the sun something to cast with: the sky reflects, it does not light the scene on its own', () => {
    const it_ = skyOver(12)
    at(it_, 12)

    // the hemisphere the landscape wrote for noon is what lights the frame
    expect(skyLight(it_.bench).visible).toBe(true)
    expect(skyLight(it_.bench).intensity).toBeGreaterThan(1)
    // and the dome over it is a reflection, not a second sky: at full strength
    // it is an order of magnitude brighter than the sun and nothing casts
    expect(it_.bench.scene.environmentIntensity).toBeGreaterThan(0)
    expect(it_.bench.scene.environmentIntensity).toBeLessThan(0.2)
  })

  it('leaves an unlit wall dark rather than black after dark', () => {
    const it_ = skyOver(0)
    at(it_, 0)

    // the whole of what reaches a wall with no lamp on it: the moon, and the
    // ambient the landscape lifts the night with
    const ambient = skyLight(it_.bench)
    expect(ambient.visible).toBe(true)
    expect(ambient.intensity).toBeGreaterThan(0.5)
    expect((it_.bench.scene.getObjectByName('land:moon') as THREE.DirectionalLight).intensity).toBeGreaterThan(0.2)
  })

  it('lights a room by the room, whatever the sky outside is doing', () => {
    const it_ = skyOver(12)
    at(it_, 12)
    const outside = it_.bench.scene.environmentIntensity

    it_.bench.indoors(true)
    at(it_, 12, false)
    const noon = it_.bench.scene.environmentIntensity
    at(it_, 0, false)
    const midnight = it_.bench.scene.environmentIntensity

    // the dome runs 85 to 1 between noon and midnight; the room does not move
    expect(noon).toBeCloseTo(INDOORS.environment, 6)
    expect(midnight).toBeCloseTo(INDOORS.environment, 6)
    expect(noon).toBeLessThan(outside)
    // and a room has no bearing on the sun, so the sky stops turning with it
    expect(it_.bench.scene.environmentRotation.y).toBe(0)

    it_.bench.indoors(false)
    at(it_, 0)
    expect(it_.bench.scene.environmentIntensity).not.toBeCloseTo(INDOORS.environment, 6)
  })

  it('takes the sky again when the sky moves, not when the hour number changes', () => {
    const it_ = skyOver(7)
    at(it_, 7)
    const taken = it_.bench.reflected
    let widest = 1

    // across sunrise the dome brightens fortyfold inside one hour: held to the
    // hour, the reflection rides that as one long ramp and the frame swings
    for (let minute = 1; minute <= 59; minute++) {
      at(it_, 7 + minute / 60)
      widest = Math.max(widest, it_.bench.brighter, 1 / it_.bench.brighter)
    }

    expect(it_.bench.reflected - taken).toBeGreaterThan(1)
    expect(widest).toBeLessThan(1.4)
  })

  it('develops a night frame darker than a day one, and glows only after dark', () => {
    expect(NIGHT.exposure).toBeLessThan(DAY.exposure)
    expect(DAY.strength).toBe(0)
    expect(NIGHT.strength).toBeGreaterThan(0)
    // a halo that reaches past its own sign reads as fog on the lens
    expect(NIGHT.radius).toBeLessThan(DAY.radius)
  })
})
