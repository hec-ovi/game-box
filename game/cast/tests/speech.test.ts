import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CLIPS, type CastMember } from '../src/index.ts'
import { loadCast, person } from './pack.ts'

const cast = await loadCast()

const degrees = (radians: number) => (radians * 180) / Math.PI

function bone(member: CastMember, name: string): THREE.Object3D {
  member.object.updateMatrixWorld(true)
  return member.object.getObjectByName(name)!
}

/** How far apart two twins' bones have turned, in degrees. Normalised first: `angleTo` reads a unit off a non-unit quaternion as a degree. */
function apart(a: CastMember, b: CastMember, name: string): number {
  const one = bone(a, name).getWorldQuaternion(new THREE.Quaternion()).normalize()
  const other = bone(b, name).getWorldQuaternion(new THREE.Quaternion()).normalize()
  return degrees(one.angleTo(other))
}

/** The widest the speaker's own right forearm rotation got off the twin's: what a layer writes on that bone alone. */
function driven(still: CastMember, talker: CastMember, seconds: number): number {
  let most = 0
  for (let step = 0; step < seconds / 0.05; step++) {
    talker.pulse()
    cast.update(0.05)
    most = Math.max(most, degrees(bone(still, 'lowerarm_r').quaternion.angleTo(bone(talker, 'lowerarm_r').quaternion)))
  }
  return most
}

/** Runs both for a while, feeding the speaker a chunk every few frames, and reports the widest the head and the arm got. */
function stream(still: CastMember, talker: CastMember, seconds: number, chunks: boolean) {
  let head = 0
  let arm = 0
  for (let step = 0; step < seconds / 0.05; step++) {
    if (chunks && step % 2 === 0) talker.pulse()
    cast.update(0.05)
    head = Math.max(head, apart(still, talker, 'Head'))
    arm = Math.max(arm, apart(still, talker, 'lowerarm_r'))
  }
  return { head, arm }
}

describe('speaking', () => {
  it('moves the head with the chunks of the line, talks with the hands, and goes still when the line ends', () => {
    // twins share an id, so the same clip is at the same point in both
    const still = cast.spawn(person({ id: 'npc_speaker' }))
    const talker = cast.spawn(person({ id: 'npc_speaker' }))
    cast.update(0.2)
    expect(talker.speaking).toBe(false)

    talker.speak(true)
    expect(talker.speaking).toBe(true)
    // nothing has arrived yet: the hands come up a little (and the talk clip
    // carries the head with them a little), the beat waits
    const waiting = stream(still, talker, 0.6, false)
    expect(waiting.arm, 'the hands did not come up while waiting for the line').toBeGreaterThan(0.5)
    expect(waiting.head, 'the head moved before a word arrived').toBeLessThan(1.5)

    const talking = stream(still, talker, 1.5, true)
    expect(talking.head - waiting.head, 'the head did not move with the words').toBeGreaterThan(2)
    expect(talking.arm, 'the hands did not talk').toBeGreaterThan(3)

    // the stream stalls: the beat is gone within a second, the hands keep going
    stream(still, talker, 0.7, false)
    const stalled = stream(still, talker, 0.5, false)
    expect(stalled.head, 'the head kept beating after the words stopped').toBeLessThan(1.5)
    expect(stalled.arm, 'the hands dropped while the line was still open').toBeGreaterThan(0.5)

    talker.speak(false)
    expect(talker.speaking).toBe(false)
    stream(still, talker, 1.5, true)
    expect(apart(still, talker, 'Head'), 'the head is still moving').toBeLessThan(0.3)
    expect(apart(still, talker, 'lowerarm_r'), 'the hands did not let go').toBeLessThan(0.05)
    expect(apart(still, talker, 'Head'), 'the head did not let go').toBeLessThan(0.05)
  })

  it('talks seated with the seated talk, and with the head alone lying down', () => {
    const seated = cast.spawn(person({ id: 'npc_sat' }), 'Sitting_Idle_Loop')
    const twin = cast.spawn(person({ id: 'npc_sat' }), 'Sitting_Idle_Loop')
    seated.speak(true)
    const sat = stream(twin, seated, 1, true)
    expect(sat.arm, 'a seated speaker does not talk with the hands').toBeGreaterThan(3)
    // the legs are the clip's alone
    expect(apart(twin, seated, 'thigh_l')).toBeLessThan(0.05)

    const lying = cast.spawn(person({ id: 'npc_abed' }), 'Sleep_Loop')
    const asleep = cast.spawn(person({ id: 'npc_abed' }), 'Sleep_Loop')
    lying.speak(true)
    const abed = stream(asleep, lying, 1, true)
    expect(abed.head, 'somebody lying down speaks with no head').toBeGreaterThan(2)
    expect(abed.arm, 'somebody lying down waved their arms about').toBeLessThan(0.05)
  })

  it('follows the clip under it: an arm the clip has busy is left out, and talks again when the clip lets go', () => {
    const still = cast.spawn(person({ id: 'npc_caller' }), 'Idle_Phone_Loop')
    const talker = cast.spawn(person({ id: 'npc_caller' }), 'Idle_Phone_Loop')
    talker.speak(true)
    expect(driven(still, talker, 1), 'the phone arm was waved about while they talked').toBeLessThan(0.05)
    still.play(CLIPS.idle, 0)
    talker.play(CLIPS.idle, 0)
    expect(driven(still, talker, 1), 'the arm did not talk once the phone was down').toBeGreaterThan(3)
  })

  it('leaves the talk to the speaker: a talk gesture over it adds nothing, a nod goes over it', () => {
    const still = cast.spawn(person({ id: 'npc_nodder' }))
    const talker = cast.spawn(person({ id: 'npc_nodder' }))
    talker.speak(true)
    talker.gesture(CLIPS.talk)
    expect(talker.gesturing, 'the talk was layered twice').toBeUndefined()
    talker.gesture('Idle_Yes_Loop')
    expect(talker.gesturing).toBe('Idle_Yes_Loop')
    expect(talker.speaking).toBe(true)
    talker.stopGesture()
    expect(talker.speaking, 'stopping a nod ended the speech').toBe(true)
    // a chunk with nobody speaking does nothing
    still.pulse()
    cast.update(0.5)
    expect(still.speaking).toBe(false)
  })
})
