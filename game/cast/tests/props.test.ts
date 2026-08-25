import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CLIPS, HANDHELD } from '../src/index.ts'
import { BODIES, loadCast, person } from './pack.ts'
import { headBone, partsOf, posed, skinsOf, skullOf } from './posing.ts'

const cast = await loadCast()

/** The ear sits about this far above the head bone, which is at the base of the skull. */
const EAR_ABOVE_THE_JOINT = 0.07

function boneOf(object: THREE.Object3D, name: string): THREE.Object3D {
  const bone = object.getObjectByName(name)
  if (!bone) throw new Error(`no bone named ${name}`)
  return bone
}

/** The head: its skin, the ellipsoid it fills, and where its bone is. */
function skull(object: THREE.Object3D) {
  object.updateMatrixWorld(true)
  const skins = skinsOf(object).filter((skin) => /^Super/i.test(skin.mesh.name))
  const head = partsOf(skins, /^Head$/)
  const shape = skullOf(head, headBone(skins) as THREE.Bone)
  const centre = headBone(skins).getWorldPosition(new THREE.Vector3())
  const point = new THREE.Vector3()
  /** How far a world point is from the nearest point of the head's skin. */
  const offTheSkin = (at: THREE.Vector3) => Math.min(...head.map((one) => posed(one.skin, one.vertex, point).distanceTo(at)))
  return { shape, centre, offTheSkin }
}

/** The thing in hand, placed by its name under a bone of this body. */
function held(object: THREE.Object3D, name: string): THREE.Object3D {
  const prop = object.getObjectByName(name)
  if (!prop) throw new Error(`nobody is holding a ${name}`)
  object.updateMatrixWorld(true)
  return prop
}

describe('what a person has in their hands', () => {
  it('reads the hand the way the props are written: fingers along +Y, palm out of +X on the left and -X on the right', () => {
    const member = cast.spawn(person({ id: 'npc_hands' }))
    cast.update(0.001)
    member.object.updateMatrixWorld(true)
    for (const side of ['l', 'r'] as const) {
      const hand = boneOf(member.object, `hand_${side}`)
      const local = (name: string) => hand.worldToLocal(boneOf(member.object, name).getWorldPosition(new THREE.Vector3()))
      expect(local(`index_01_${side}`).y, `${side}: the fingers do not run along +Y`).toBeGreaterThan(0.1)
      expect(local(`index_01_${side}`).z - local(`pinky_01_${side}`).z, `${side}: the index finger is not at +Z of the little one`).toBeGreaterThan(0.05)
      expect(Math.sign(local(`thumb_01_${side}`).x), `${side}: the thumb is on the wrong side`).toBe(side === 'r' ? -1 : 1)
    }
  })

  it('puts the phone against the ear for every phone clip, and takes it away with the clip', () => {
    for (const clip of Object.keys(HANDHELD).filter((name) => HANDHELD[name]!.prop === 'phone')) {
      for (const base of BODIES) {
        const member = cast.spawn(person({ id: `npc_phone_${base}`, appearance: { base, variant: 1 } }), clip)
        expect(member.holding?.name, `${clip}: nothing in the hand`).toBe('phone')
        for (let step = 0; step <= 8; step++) {
          cast.update(step === 0 ? 0.001 : 0.35)
          const phone = held(member.object, 'phone')
          const { centre, offTheSkin } = skull(member.object)
          const middle = phone.getWorldPosition(new THREE.Vector3())
          // against the ear: level with the head's middle, a finger off the skin, never in it
          const gap = offTheSkin(middle)
          expect(gap, `${base} in ${clip}: the phone floats ${gap.toFixed(3)} m off the head`).toBeLessThan(0.06)
          expect(gap, `${base} in ${clip}: the phone is in the head`).toBeGreaterThan(0.004)
          expect(Math.abs(middle.y - centre.y - EAR_ABOVE_THE_JOINT), `${base} in ${clip}: the phone is not at ear height`).toBeLessThan(0.08)
        }
        member.play(CLIPS.idle, 0)
        expect(member.holding, 'the phone stayed in the hand after the clip ended').toBeUndefined()
        expect(member.object.getObjectByName('phone')).toBeUndefined()
      }
    }
  })

  it('holds the cigarette at the mouth', () => {
    const member = cast.spawn(person({ id: 'npc_smoke' }), 'Idle_WallSmoke_Loop')
    cast.update(0.001)
    const cigarette = held(member.object, 'cigarette')
    const { shape, centre } = skull(member.object)
    // the filter end is the local +Y end
    const filter = cigarette.localToWorld(new THREE.Vector3(0, 0.0425, 0))
    const tip = cigarette.localToWorld(new THREE.Vector3(0, -0.0425, 0))
    expect(filter.distanceTo(centre), 'the filter is not at the face').toBeLessThan(0.13)
    expect(shape.inside(tip), 'the lit end is inside the head').toBe(false)
    expect(tip.distanceTo(centre), 'the lit end is not held away from the face').toBeGreaterThan(filter.distanceTo(centre))
  })

  it('brings the glass to the lips at the top of every drink loop, upright on the way, and the roll to the mouth', () => {
    const toTheMouth = Object.keys(HANDHELD).filter((name) => ['glass', 'food'].includes(HANDHELD[name]!.prop))
    expect(toTheMouth.length).toBeGreaterThan(3)
    for (const clip of toTheMouth) {
      for (const base of BODIES) {
        const member = cast.spawn(person({ id: `npc_mouth_${base}`, appearance: { base, variant: 1 } }), clip)
        const what = HANDHELD[clip]!.prop
        let nearest = Infinity
        let lowest = Infinity
        for (let step = 0; step <= 44; step++) {
          cast.update(step === 0 ? 0.001 : 0.05)
          const thing = held(member.object, what)
          const { shape, offTheSkin } = skull(member.object)
          // the open end is the local +Z end, toward the index finger
          const end = thing.localToWorld(new THREE.Vector3(0, 0, 0.05))
          const middle = thing.getWorldPosition(new THREE.Vector3())
          const up = new THREE.Vector3(0, 0, 1).applyQuaternion(thing.getWorldQuaternion(new THREE.Quaternion()))
          const tilt = (up.angleTo(new THREE.Vector3(0, 1, 0)) * 180) / Math.PI
          nearest = Math.min(nearest, offTheSkin(end))
          lowest = Math.min(lowest, middle.y)
          expect(shape.inside(middle), `${base} in ${clip}: the ${what} is in the head`).toBe(false)
          // a drink tips toward the mouth at the top and never past that
          if (what === 'glass') expect(tilt, `${base} in ${clip}: the glass tips ${tilt.toFixed(0)} degrees`).toBeLessThan(50)
        }
        expect(nearest, `${base} in ${clip}: the ${what} gets no nearer the lips than ${nearest.toFixed(3)} m`).toBeLessThan(0.05)
        // and it comes down again: a whole loop travels, to the lap in a chair, 0.3 m higher on a stool
        const rest = clip.startsWith('Sitting_') && !clip.includes('Stool') ? 0.9 : 1.2
        expect(lowest, `${base} in ${clip}: the ${what} never comes down`).toBeLessThan(rest)
      }
    }
  })

  it('stands the hand light up out of the fist', () => {
    const member = cast.spawn(person({ id: 'npc_torch' }), 'Idle_Torch_Loop')
    cast.update(0.5)
    const torch = held(member.object, 'torch')
    const up = new THREE.Vector3(0, 0, 1).applyQuaternion(torch.getWorldQuaternion(new THREE.Quaternion()))
    expect((up.angleTo(new THREE.Vector3(0, 1, 0)) * 180) / Math.PI, 'the light is not held upright').toBeLessThan(30)
    expect(torch.getWorldPosition(new THREE.Vector3()).y, 'the light is not held up').toBeGreaterThan(1.1)
  })

  it('runs the trolley handle through both hands', () => {
    const member = cast.spawn(person({ id: 'npc_push' }), 'Push_Loop')
    for (let step = 0; step <= 8; step++) {
      cast.update(step === 0 ? 0.001 : 0.3)
      const trolley = held(member.object, 'trolley')
      const handle = trolley.children[0]!
      handle.updateWorldMatrix(true, false)
      const bar = new THREE.Vector3()
      const worst = Math.max(
        ...(['hand_l', 'hand_r'] as const).map((name) => {
          const hand = boneOf(member.object, name).getWorldPosition(new THREE.Vector3())
          // the bar runs across x: measure off its axis
          handle.worldToLocal(bar.copy(hand))
          return Math.hypot(bar.y, bar.z)
        }),
      )
      expect(worst, `a hand is ${worst.toFixed(2)} m off the handle`).toBeLessThan(0.06)
    }
  })
})
