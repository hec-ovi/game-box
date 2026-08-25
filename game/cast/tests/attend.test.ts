import { METRICS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Cast, CLIPS, type CastMember } from '../src/index.ts'
import { loadCast, person } from './pack.ts'
import { centroid, partsOf, skinsOf } from './posing.ts'

const cast = await loadCast()

function run(seconds: number): void {
  for (let step = 0; step < seconds / 0.05; step++) cast.update(0.05)
}

/** Which way the face points on the ground, as a unit vector in world space. */
function faceDirection(member: CastMember): THREE.Vector3 {
  member.object.updateMatrixWorld(true)
  const skins = skinsOf(member.object).filter((skin) => !/^(hair|beard|brows)_/.test(skin.mesh.name))
  const eyes = skins.find((skin) => skin.mesh.name === 'Eyes')!
  const face = centroid(Array.from({ length: eyes.position.count }, (_, vertex) => ({ skin: eyes, vertex })))
  const head = centroid(partsOf(skins, /^Head$/))
  return face.sub(head).setY(0).normalize()
}

function pelvisHeight(member: CastMember): number {
  member.object.updateMatrixWorld(true)
  return member.object.getObjectByName('pelvis')!.getWorldPosition(new THREE.Vector3()).y
}

const degrees = (radians: number) => (radians * 180) / Math.PI

describe('being spoken to', () => {
  it('brings a bent-over worker up to a relaxed idle facing the speaker, without moving them', () => {
    const member = cast.spawn(person({ id: 'npc_bench' }), Cast.doingAt('work-bench'))
    member.object.position.set(4, 0, -7)
    member.object.rotation.y = 0.6
    run(0.3)
    const before = { position: member.object.position.clone(), yaw: member.object.rotation.y }

    // three metres off to the person's left
    const speaker = new THREE.Vector3(4 + 3 * Math.cos(0.6), 1.6, -7 - 3 * Math.sin(0.6))
    member.attend(speaker)
    run(1.5)

    expect(member.attending).toBe(true)
    expect(member.playing).toBe(CLIPS.idle)
    const toSpeaker = speaker.clone().sub(member.object.position).setY(0).normalize()
    expect(degrees(faceDirection(member).angleTo(toSpeaker)), 'the body did not turn to the speaker').toBeLessThan(15)
    expect(member.object.position.equals(before.position), 'the position moved').toBe(true)
    expect(member.object.rotation.y, 'the object was turned instead of the body inside it').toBe(before.yaw)

    member.resume()
    run(1.5)
    expect(member.attending).toBe(false)
    expect(member.playing).toBe(Cast.doingAt('work-bench'))
    expect(degrees(faceDirection(member).angleTo(new THREE.Vector3(-Math.sin(0.6), 0, -Math.cos(0.6)))), 'the body did not turn back').toBeLessThan(15)
  })

  it('keeps a desk worker in the chair, upright, hands off the desk, turned to the speaker', () => {
    const member = cast.spawn(person({ id: 'npc_desk' }), Cast.doingAt('work-desk'))
    run(0.3)
    const before = faceDirection(member)
    member.attend(new THREE.Vector3(2, 1.6, -2))
    run(1.5)

    expect(member.playing).toBe('Sitting_Idle_Loop')
    expect(pelvisHeight(member), 'they stood up').toBeLessThan(METRICS.furniture.seatHeight + 0.15)
    expect(degrees(faceDirection(member).angleTo(before)), 'the head did not turn').toBeGreaterThan(20)

    member.resume()
    run(1)
    expect(member.playing).toBe(Cast.doingAt('work-desk'))
  })

  it('keeps somebody on a stool at stool height', () => {
    const member = cast.spawn(person({ id: 'npc_stool' }), Cast.doingAt('sit-drink'))
    run(0.3)
    member.attend(new THREE.Vector3(1, 1.6, -3))
    run(1)
    expect(member.playing).toBe('Sitting_Stool_Loop')
    expect(pelvisHeight(member), 'they dropped to chair height').toBeGreaterThan(METRICS.furniture.stoolHeight)
  })

  it('stands a seated person up when the speaker is behind them, and sits them back down', () => {
    const member = cast.spawn(person({ id: 'npc_behind' }), Cast.doingAt('work-desk'))
    run(0.3)
    member.attend(new THREE.Vector3(0.5, 1.6, 3))
    expect(member.playing).toBe(CLIPS.standUp)
    run(1.6)
    expect(member.playing).toBe(CLIPS.idle)
    expect(pelvisHeight(member), 'they are still sat down').toBeGreaterThan(0.8)

    member.resume()
    expect(member.playing).toBe(CLIPS.sitDown)
    run(1.8)
    expect(member.playing).toBe(Cast.doingAt('work-desk'))
    expect(pelvisHeight(member)).toBeLessThan(METRICS.furniture.seatHeight + 0.15)
  })

  it('leaves a sleeper lying down', () => {
    const member = cast.spawn(person({ id: 'npc_asleep' }), Cast.doingAt('sleep'))
    member.attend(new THREE.Vector3(2, 1.6, 0))
    run(0.5)
    expect(member.playing).toBe(Cast.doingAt('sleep'))
    member.resume()
    expect(member.attending).toBe(false)
  })

  it('is ended by any clip the game plays', () => {
    const member = cast.spawn(person({ id: 'npc_walks_off' }), Cast.doingAt('stand'))
    member.attend(new THREE.Vector3(2, 1.6, 0))
    member.play(CLIPS.walk)
    expect(member.attending).toBe(false)
    expect(member.playing).toBe(CLIPS.walk)
  })
})
