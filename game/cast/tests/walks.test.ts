import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { BodyKind } from '@gb/world'
import { GAITS, WALKS } from '../src/index.ts'
import { BODIES, clipLengths, loadCast, person } from './pack.ts'

/**
 * What a pedestrian is given to walk with.
 *
 * A walk whose arms hang still through the cycle does not read as a different
 * person, it reads as one person with something wrong with them: the packs'
 * own `Walk_Formal_Loop` swings a shoulder 2.6 degrees over a cycle, less than
 * a body standing still, and a street where every other body walks like that
 * is what a player calls rigid. So every walk on the shelf swings, and what
 * tells them apart is carriage: where the hands are carried, how far apart,
 * how bent the elbows are and how far the head is out over the hips.
 */

/** Degrees a shoulder turns through over one cycle. The shipped walks make 31 to 33; a pinned arm makes 3. */
const LEAST_SWING = 20

/** Metres a hand travels over one cycle. The shipped walks make 0.71 to 0.87; a pinned arm makes 0.19. */
const LEAST_TRAVEL = 0.5

/** Metres apart two walks carry the same hand. Two walks closer than this are one walk twice. */
const LEAST_APART = 0.04

const SAMPLES = 96

interface Walking {
  /** Degrees each shoulder and elbow turns through over the cycle. */
  readonly swing: Map<string, number>
  /** Metres each hand travels over the cycle. */
  readonly travel: Map<string, number>
  /** Where each hand is carried, in the body's own frame. */
  readonly carried: Map<string, THREE.Vector3>
  /** The narrowest and widest the elbow opens, in degrees: 180 is a straight arm. */
  readonly elbow: { least: number; most: number }
  /** Metres the head is carried ahead of the hips: how far the body leans into the walk. */
  readonly lean: number
}

function bonesOf(object: THREE.Object3D): Map<string, THREE.Bone> {
  const bones = new Map<string, THREE.Bone>()
  object.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    for (const bone of mesh.skeleton.bones) bones.set(bone.name, bone)
  })
  return bones
}

/** The widest angle between any two frames of a bone's own turn: how far it swings. */
function widest(turns: THREE.Quaternion[]): number {
  let most = 0
  for (let a = 0; a < turns.length; a++) {
    for (let b = a + 1; b < turns.length; b++) {
      most = Math.max(most, 2 * Math.acos(Math.min(1, Math.abs(turns[a]!.dot(turns[b]!)))))
    }
  }
  return (most * 180) / Math.PI
}

/** How far open an elbow is, in degrees, from the three joints of one arm. */
function opening(shoulder: THREE.Vector3, elbow: THREE.Vector3, wrist: THREE.Vector3): number {
  const bend = elbow.clone().sub(shoulder).angleTo(wrist.clone().sub(elbow))
  return 180 - (bend * 180) / Math.PI
}

/** One walk on one body, over exactly one cycle. */
async function walking(clip: string, base: BodyKind): Promise<Walking> {
  const cast = await loadCast()
  const cycle = (await clipLengths()).get(clip)
  if (!cycle) throw new Error(`${clip} is not in the pack`)
  const member = cast.spawn(person({ id: `npc_${clip}`, appearance: { base, variant: 1 } }), clip)
  const bones = bonesOf(member.object)
  const turns = new Map<string, THREE.Quaternion[]>()
  const path = new Map<string, THREE.Vector3[]>()
  for (const side of ['l', 'r']) {
    for (const joint of [`upperarm_${side}`, `lowerarm_${side}`]) turns.set(joint, [])
    path.set(`hand_${side}`, [])
  }
  const elbow = { least: 180, most: 0 }
  let lean = 0

  for (let frame = 0; frame <= SAMPLES; frame++) {
    cast.update(cycle / SAMPLES)
    member.object.updateMatrixWorld(true)
    for (const [joint, seen] of turns) seen.push(bones.get(joint)!.quaternion.clone())
    // the object faces -Z, so a point ahead of the body has the smaller z
    const intoBody = new THREE.Matrix4().copy(member.object.matrixWorld).invert()
    const at = (bone: string) => bones.get(bone)!.getWorldPosition(new THREE.Vector3()).applyMatrix4(intoBody)
    for (const [hand, seen] of path) seen.push(at(hand))
    for (const side of ['l', 'r']) {
      const open = opening(at(`upperarm_${side}`), at(`lowerarm_${side}`), at(`hand_${side}`))
      elbow.least = Math.min(elbow.least, open)
      elbow.most = Math.max(elbow.most, open)
    }
    lean += at('pelvis').z - at('Head').z
  }

  const travel = new Map<string, number>()
  const carried = new Map<string, THREE.Vector3>()
  for (const [hand, seen] of path) {
    let metres = 0
    for (let frame = 1; frame < seen.length; frame++) metres += seen[frame]!.distanceTo(seen[frame - 1]!)
    travel.set(hand, metres)
    carried.set(hand, seen.reduce((sum, one) => sum.add(one), new THREE.Vector3()).divideScalar(seen.length))
  }
  return {
    swing: new Map([...turns].map(([joint, seen]) => [joint, widest(seen)])),
    travel,
    carried,
    elbow,
    lean: lean / (SAMPLES + 1),
  }
}

describe('the walks a pedestrian may be given', () => {
  it('swings every one of them: arms that hang still read as a broken body, not another person', async () => {
    for (const walk of WALKS) {
      // a walk outside GAITS is played at the speed it was authored for whatever
      // the body is doing, so the feet skate: being paced is part of being a walk
      expect(GAITS[walk], `${walk} has no authored speed to pace it against`).toBeGreaterThan(0)
      for (const base of BODIES) {
        const { swing, travel } = await walking(walk, base)
        for (const [joint, degrees] of swing) {
          expect(degrees, `${walk} on a ${base} body barely turns its ${joint}`).toBeGreaterThan(LEAST_SWING)
        }
        for (const [hand, metres] of travel) {
          expect(metres, `${walk} on a ${base} body barely moves its ${hand}`).toBeGreaterThan(LEAST_TRAVEL)
        }
      }
    }
  }, 120000)

  it('carries each of them differently, so a street is not one person over and over', async () => {
    const walks = new Map<string, Walking>()
    for (const walk of WALKS) walks.set(walk, await walking(walk, BODIES[0]!))

    for (const [walk, mine] of walks) {
      for (const [other, theirs] of walks) {
        if (other === walk) continue
        const hands = Math.max(...[...mine.carried].map(([hand, at]) => at.distanceTo(theirs.carried.get(hand)!)))
        const elbows = Math.abs(mine.elbow.least - theirs.elbow.least)
        const lean = Math.abs(mine.lean - theirs.lean)
        const apart = hands > LEAST_APART || elbows > 10 || lean > LEAST_APART
        expect(apart, `${walk} and ${other} are one walk twice: hands ${hands.toFixed(3)} m, elbows ${elbows.toFixed(0)} degrees, lean ${lean.toFixed(3)} m`).toBe(true)
      }
    }
  }, 120000)
})
