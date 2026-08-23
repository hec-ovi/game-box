import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CLIPS, GESTURES, type CastMember } from '../src/index.ts'
import { loadCast, person } from './pack.ts'

const cast = await loadCast()

function boneOf(object: THREE.Object3D, name: string): THREE.Bone {
  let found: THREE.Bone | undefined
  object.traverse((child) => {
    if ((child as THREE.Bone).isBone && child.name === name) found = child as THREE.Bone
  })
  if (!found) throw new Error(`no bone named ${name}`)
  return found
}

/** Where a bone's face points now, measured against the rest pose it started in. */
function facing(object: THREE.Object3D, bone: THREE.Bone, rest: THREE.Vector3): THREE.Vector3 {
  object.updateMatrixWorld(true)
  return rest.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()))
}

/** The direction the face points in the bone's own frame, taken before anything animates. */
function restForward(object: THREE.Object3D, bone: THREE.Bone): THREE.Vector3 {
  object.updateMatrixWorld(true)
  // a spawned body faces -Z at rotation.y = 0
  return new THREE.Vector3(0, 0, -1).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert())
}

function run(seconds: number): void {
  for (let step = 0; step < seconds / 0.05; step++) cast.update(0.05)
}

const degrees = (radians: number) => (radians * 180) / Math.PI

describe('the head-look layer', () => {
  it('turns the head toward the target and holds it there', () => {
    const member = cast.spawn(person({ id: 'npc_look' }))
    const head = boneOf(member.object, 'Head')
    const rest = restForward(member.object, head)
    run(0.2)
    const before = facing(member.object, head, rest)

    // three metres to the character's right, at head height
    const target = new THREE.Vector3(3, 1.6, 0)
    member.lookAt(target)
    run(1.5)

    const after = facing(member.object, head, rest)
    const wanted = target.clone().sub(head.getWorldPosition(new THREE.Vector3())).normalize()
    expect(degrees(after.angleTo(before)), 'the head did not turn').toBeGreaterThan(50)
    expect(degrees(after.angleTo(wanted)), 'the head turned but not at the target').toBeLessThan(
      degrees(before.angleTo(wanted)),
    )
  })

  it('stops at the cone rather than following the target round', () => {
    const member = cast.spawn(person({ id: 'npc_behind' }))
    const head = boneOf(member.object, 'Head')
    const rest = restForward(member.object, head)
    run(0.2)
    const before = facing(member.object, head, rest)

    member.lookAt(new THREE.Vector3(0, 1.6, -4))
    run(2)

    const after = facing(member.object, head, rest)
    expect(degrees(after.angleTo(before)), 'the head came off').toBeLessThan(85)
  })

  it('eases back to the clip when the player walks away', () => {
    const member = cast.spawn(person({ id: 'npc_away' }))
    const head = boneOf(member.object, 'Head')
    const rest = restForward(member.object, head)
    run(0.2)
    const before = facing(member.object, head, rest)

    member.lookAt(new THREE.Vector3(3, 1.6, 0))
    run(1.5)
    const turned = facing(member.object, head, rest)
    member.lookAway()
    run(1.5)
    const back = facing(member.object, head, rest)

    expect(degrees(turned.angleTo(before))).toBeGreaterThan(50)
    // the clip keeps moving the head a little, so this is "back to the clip", not "identical"
    expect(degrees(back.angleTo(before)), 'the head stayed turned').toBeLessThan(8)
  })
})

describe('the gesture layer', () => {
  it('adds an upper-body clip over the base clip and leaves the legs to it', () => {
    // one id for all four, so the twins share a phase and the two gestures are
    // at the same point in their own loop
    const seated = cast.spawn(person({ id: 'npc_twin' }), 'Sitting_Idle_Loop')
    const seatedTalking = cast.spawn(person({ id: 'npc_twin' }), 'Sitting_Idle_Loop')
    const standing = cast.spawn(person({ id: 'npc_twin' }), 'Idle_Loop')
    const standingTalking = cast.spawn(person({ id: 'npc_twin' }), 'Idle_Loop')
    seatedTalking.gesture(CLIPS.talk)
    standingTalking.gesture(CLIPS.talk)
    expect(seatedTalking.gesturing).toBe(CLIPS.talk)

    const apart = (a: CastMember, b: CastMember, bone: string) =>
      degrees(boneOf(a.object, bone).quaternion.angleTo(boneOf(b.object, bone).quaternion))

    // the gesture passes through its own start pose once a loop, so watch a
    // whole loop rather than one frame
    let arms = 0
    let legs = 0
    let held = 1
    for (let step = 0; step < 60; step++) {
      cast.update(0.05)
      arms = Math.max(arms, apart(seated, seatedTalking, 'lowerarm_r'))
      legs = Math.max(legs, apart(seated, seatedTalking, 'thigh_l'))
      // the same gesture added to two different clips turns both arms by the
      // same rotation, so the gap between the two poses survives untouched;
      // a layer that overwrote them would close that gap
      held = Math.min(held, apart(seatedTalking, standingTalking, 'lowerarm_r') / apart(seated, standing, 'lowerarm_r'))
    }
    expect(arms, 'the gesture did not reach the arms').toBeGreaterThan(3)
    expect(legs, 'the gesture leaked into the legs').toBeLessThan(0.01)
    expect(held, 'the gesture replaced the base pose instead of adding to it').toBeGreaterThan(0.95)

    seatedTalking.stopGesture()
    run(1)
    expect(seatedTalking.gesturing).toBeUndefined()
    expect(apart(seated, seatedTalking, 'lowerarm_r'), 'the gesture did not let go').toBeLessThan(0.01)
  })

  it('plays every gesture the table offers', () => {
    // a gesture the pack has not got is ignored rather than thrown, so a name
    // that never made it into the build would be a silently still NPC
    const member = cast.spawn(person({ id: 'npc_gestures' }))
    for (const gesture of GESTURES) {
      member.gesture(gesture, 0)
      expect(member.gesturing, `${gesture} is named in the table but is not in the pack`).toBe(gesture)
    }
  })

  it('ignores a gesture it does not have', () => {
    const member = cast.spawn(person({ id: 'npc_mime' }))
    member.gesture('Semaphore_Of_Doom')
    expect(member.gesturing).toBeUndefined()
  })
})
