import { ANCHOR_KINDS, BODY_KINDS, METRICS } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Cast, CLIPS, CLIPS_FOR_ANCHOR, clipsUsed, GESTURES } from '../src/index.ts'
import { loadCast, person } from './pack.ts'
import { centroid, headBone, partsOf, posed, posedBounds, skinsOf, skullOf, type Skin } from './posing.ts'

const cast = await loadCast()

/**
 * The parts that must never end up inside a head. Forearms, hands and legs
 * only: an upper arm hangs off the shoulder, which is close enough to the head
 * on any rig, and a hand may brush a cheek without it being a fault. A forearm
 * through the skull is the fault.
 */
const LIMB = /^(lowerarm_|thigh_|calf_|foot_|ball_)/

/** Hair is part of the head but not part of its shape: long hair reaches the shoulders. */
const ADDED = /^(hair|beard|brows)_/

const degrees = (radians: number) => (radians * 180) / Math.PI

/** How high off the floor one joint of a posed body sits. */
function jointHeight(object: THREE.Object3D, name: string): number {
  object.updateMatrixWorld(true)
  const bone = object.getObjectByName(name)
  if (!bone) throw new Error(`this character has no ${name} bone`)
  return bone.getWorldPosition(new THREE.Vector3()).y
}

/** The skin and clothes, without the hair pieces bolted on at spawn. */
function bodySkins(object: THREE.Object3D): Skin[] {
  return skinsOf(object).filter((skin) => !ADDED.test(skin.mesh.name))
}

/**
 * How far the rig has turned off the pose it was bound in, in radians. Zero is
 * the rest pose, which for this art is a T-pose. Measured bone by bone against
 * the bind pose the inverse bind matrices carry, so it does not care which way
 * the body as a whole is facing.
 */
function offRest(object: THREE.Object3D): number {
  object.updateMatrixWorld(true)
  const { bones, boneInverses } = bodySkins(object)[0]!.mesh.skeleton
  const slot = new Map(bones.map((bone, index) => [bone, index]))
  const bindWorld = boneInverses.map((inverse) => new THREE.Matrix4().copy(inverse).invert())

  const local = new THREE.Matrix4()
  const place = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const rest = new THREE.Quaternion()
  let worst = 0
  for (let index = 0; index < bones.length; index++) {
    const parent = slot.get(bones[index]!.parent as THREE.Bone)
    if (parent === undefined) continue
    local.multiplyMatrices(new THREE.Matrix4().copy(bindWorld[parent]!).invert(), bindWorld[index]!)
    local.decompose(place, rest, scale)
    worst = Math.max(worst, rest.angleTo(bones[index]!.quaternion))
  }
  return worst
}

describe('what a spawned person is doing', () => {
  it('never stands in the rest pose, whatever anchor they are on', () => {
    for (const kind of ANCHOR_KINDS) {
      for (const clip of CLIPS_FOR_ANCHOR[kind]) {
        for (const base of BODY_KINDS) {
          const member = cast.spawn(person({ id: `npc_${clip}_${base}`, appearance: { base, variant: 1 } }), clip)
          cast.update(0.4)
          expect(member.playing, `nothing is playing on the ${kind} anchor`).toBe(clip)
          expect(
            degrees(offRest(member.object)),
            `${base} on a ${kind} anchor is still in the rest pose, playing ${clip}`,
          ).toBeGreaterThan(5)
        }
      }
    }
  })

  /**
   * The gap `@gb/forge` has to leave between a wall and a lean anchor. The
   * clips tip the body back off its own feet, so the shoulders end up well
   * behind the root; measured here across every outfit and every point in the
   * loop, and published in CONTRACT.md because forge cannot import this box.
   */
  it('props a leaning body against a wall behind it, feet still on the floor', () => {
    const STANDOFF = 0.44
    let worst = 0
    for (const clip of CLIPS_FOR_ANCHOR.lean) {
      for (const base of BODY_KINDS) {
        const member = cast.spawn(person({ id: `npc_lean_${clip}_${base}`, appearance: { base, variant: 1 } }), clip)
        for (let step = 0; step <= 12; step++) {
          cast.update(step === 0 ? 0.001 : 0.2)
          // a body at rotation.y = 0 faces -Z, so its back is the larger z
          const bounds = posedBounds(member.object)
          const back = bounds.max.z
          worst = Math.max(worst, back)
          expect(back, `${base} doing ${clip} reaches ${back.toFixed(3)} m behind the anchor`).toBeLessThan(STANDOFF)
          expect(back, `${base} doing ${clip} is standing upright, not propped on anything`).toBeGreaterThan(0.25)
          expect(bounds.min.y, `${base} doing ${clip} has a foot through the floor`).toBeGreaterThan(-0.02)
        }
      }
    }
    // and the gap is the measurement, not a number somebody rounded up: a clip
    // change that gains 5 cm of clearance has to move the published one too
    expect(STANDOFF - worst, `the widest body clears the wall by ${(STANDOFF - worst).toFixed(3)} m`).toBeLessThan(0.05)
  })

  it('stands a bench worker up with their hands on the top, and sits a desk worker down', () => {
    for (const base of BODY_KINDS) {
      const bench = cast.spawn(person({ id: `npc_bench_${base}`, appearance: { base, variant: 1 } }), Cast.doingAt('work-bench'))
      const desk = cast.spawn(person({ id: `npc_desk_${base}`, appearance: { base, variant: 1 } }), Cast.doingAt('work-desk'))
      cast.update(0.4)

      // the bench is drawn at the service counter height, and this is the clip
      // that reaches for it: hands on the top, hips where a standing body's are
      const hands = (jointHeight(bench.object, 'hand_l') + jointHeight(bench.object, 'hand_r')) / 2
      expect(Math.abs(hands - METRICS.furniture.serviceCounterHeight), `${base}'s hands are at ${hands} m`).toBeLessThan(0.05)
      expect(jointHeight(bench.object, 'pelvis'), `${base} is not on their feet at the bench`).toBeGreaterThan(0.85)

      // and the desk worker is in the chair, hips a hand over the seat
      expect(jointHeight(desk.object, 'pelvis'), `${base} is not sat at the desk`).toBeLessThan(
        METRICS.furniture.seatHeight + 0.15,
      )
    }
  })

  it('falls back to an idle when it is handed a clip the library has not got', () => {
    const member = cast.spawn(person({ id: 'npc_typo' }), 'Idle_Loopp')
    cast.update(0.4)
    expect(member.playing).toBe(CLIPS.idle)
    expect(degrees(offRest(member.object))).toBeGreaterThan(5)
  })

  it(
    'never folds a limb into the head, through any clip it plays or gesture it layers',
    () => {
      const cases: Array<[string, string | undefined]> = []
      for (const clip of clipsUsed()) {
        cases.push([clip, undefined])
        for (const gesture of GESTURES) cases.push([clip, gesture])
      }

      for (const base of BODY_KINDS) {
        const member = cast.spawn(person({ id: `npc_head_${base}`, appearance: { base, variant: 1 } }))
        const skins = bodySkins(member.object)
        const head = partsOf(skins, /^Head$/)
        const limbs = partsOf(skins, LIMB)
        const bone = headBone(skins)
        expect(head.length, 'no head to test against').toBeGreaterThan(100)
        expect(limbs.length, 'no limbs to test').toBeGreaterThan(100)

        const point = new THREE.Vector3()
        for (const [clip, gesture] of cases) {
          member.play(clip, 0)
          member.stopGesture(0)
          if (gesture) member.gesture(gesture, 0)
          // a whole loop of the longest clip the game plays, in steps
          for (let step = 0; step <= 24; step++) {
            cast.update(step === 0 ? 0.001 : 0.1)
            member.object.updateMatrixWorld(true)
            const skull = skullOf(head, bone)
            // a head that has collapsed or swallowed the body would make this
            // test pass by measuring nothing
            expect(Math.min(...skull.half.toArray()), `${base}: the head measures ${skull.half.toArray()} m`).toBeGreaterThan(0.04)
            expect(Math.max(...skull.half.toArray()), `${base}: the head measures ${skull.half.toArray()} m`).toBeLessThan(0.15)
            for (const limb of limbs) {
              if (!skull.inside(posed(limb.skin, limb.vertex, point))) continue
              expect.fail(`${base}: ${limb.bone} is inside the head during ${clip}${gesture ? ` + ${gesture}` : ''}`)
            }
          }
        }
      }
    },
    60_000,
  )
})

describe('which way a spawned person faces', () => {
  it('faces -Z at rotation.y = 0, so what is in front has the smaller z', () => {
    for (const base of BODY_KINDS) {
      const member = cast.spawn(person({ id: `npc_facing_${base}`, appearance: { base, variant: 1 } }))
      cast.update(0.001)
      const { face, head } = landmarks(member.object)
      expect(face.z, `${base} faces +Z: the art was not turned round`).toBeLessThan(head.z)
      expect(head.z - face.z, `${base} has no depth to its head`).toBeGreaterThan(0.02)
    }
  })

  it('turns with the object the game moves, so a heading points them where they walk', () => {
    const member = cast.spawn(person({ id: 'npc_turning' }))
    cast.update(0.001)
    // a quarter turn: what faced -Z now faces -X
    member.object.rotation.y = Math.PI / 2
    const { face, head } = landmarks(member.object)
    expect(face.x).toBeLessThan(head.x)
    expect(Math.abs(face.z - head.z), 'the head did not turn with the object').toBeLessThan(0.02)
  })
})

/** The eyes, which are the front of a face, and the middle of the head behind them. */
function landmarks(object: THREE.Object3D): { face: THREE.Vector3; head: THREE.Vector3 } {
  object.updateMatrixWorld(true)
  const skins = bodySkins(object)
  const eyes = skins.find((skin) => skin.mesh.name === 'Eyes')
  expect(eyes, 'no eyes on this character').toBeDefined()
  const all = Array.from({ length: eyes!.position.count }, (_, vertex) => ({ skin: eyes!, vertex }))
  return { face: centroid(all), head: centroid(partsOf(skins, /^Head$/)) }
}
