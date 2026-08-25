import { METRICS, NPC_ROLES } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildFor, clipsUsed, HANDHELD, type Build, type CastMember } from '../src/index.ts'
import { BODIES, loadCast, person } from './pack.ts'
import { partsOf, posed, posedBounds, skinsOf } from './posing.ts'

const cast = await loadCast()

const HEAVY_ROLES = ['guard', 'worker', 'mechanic'] as const

/** An id of somebody in this role with this build, so a test can spawn one of each. */
function someone(role: (typeof NPC_ROLES)[number], build: Build): string {
  for (let n = 0; n < 500; n++) {
    const id = `npc_${role}_${n}`
    if (buildFor({ id, role }) === build) return id
  }
  throw new Error(`no ${build} ${role} in 500 ids`)
}

/** The skin, without the hair pieces bolted on at spawn. */
function body(member: CastMember) {
  return skinsOf(member.object).filter((skin) => !/^(hair|beard|brows)_/.test(skin.mesh.name))
}

function joint(member: CastMember, name: string): THREE.Vector3 {
  member.object.updateMatrixWorld(true)
  return member.object.getObjectByName(name)!.getWorldPosition(new THREE.Vector3())
}

/** How far the skin of one bone sits off that bone's own axis, on average: how thick the part is. */
function thickness(member: CastMember, bone: string, end: string): number {
  const from = joint(member, bone)
  const axis = joint(member, end).sub(from).normalize()
  const skin = partsOf(body(member), new RegExp(`^${bone}$`))
  const point = new THREE.Vector3()
  let sum = 0
  for (const one of skin) {
    posed(one.skin, one.vertex, point).sub(from)
    sum += point.sub(axis.clone().multiplyScalar(point.dot(axis))).length()
  }
  return sum / skin.length
}

/** How far a world point is from the nearest point of this body's own head skin. */
function offTheHead(member: CastMember, at: THREE.Vector3): number {
  member.object.updateMatrixWorld(true)
  const point = new THREE.Vector3()
  return Math.min(...partsOf(body(member), /^Head$/).map((one) => posed(one.skin, one.vertex, point).distanceTo(at)))
}

/** Everything a body's proportions come to, measured on the skin and the joints. */
function proportions(member: CastMember) {
  cast.update(0.001)
  const bounds = posedBounds(member.object)
  return {
    height: bounds.max.y,
    shoulders: joint(member, 'upperarm_l').distanceTo(joint(member, 'upperarm_r')),
    chest: thickness(member, 'spine_03', 'neck_01'),
    upperArm: thickness(member, 'upperarm_l', 'lowerarm_l'),
    head: thickness(member, 'Head', 'neck_01'),
  }
}

describe('the heavy build', () => {
  it('goes to a minority of guards, workers and mechanics, the same person every time', () => {
    for (const role of NPC_ROLES) {
      const heavy = Array.from({ length: 300 }, (_, n) => buildFor({ id: `npc_${n}`, role })).filter((build) => build === 'heavy').length
      if ((HEAVY_ROLES as readonly string[]).includes(role)) {
        expect(heavy / 300, `${heavy} of 300 ${role}s are heavy`).toBeGreaterThan(0.2)
        expect(heavy / 300, `${heavy} of 300 ${role}s are heavy`).toBeLessThan(0.4)
      } else {
        expect(heavy, `a ${role} came out heavy`).toBe(0)
      }
    }
    const id = someone('guard', 'heavy')
    expect(buildFor({ id, role: 'guard' })).toBe(buildFor({ id, role: 'guard' }))
    expect(cast.spawn(person({ id, role: 'guard' })).build).toBe('heavy')
  })

  it('is wider at the shoulders, thicker through the chest and the arms and a little taller, with the same head', () => {
    for (const base of BODIES) {
      const regular = proportions(cast.spawn(person({ id: someone('guard', 'regular'), role: 'guard', appearance: { base, variant: 1 } })))
      const heavy = proportions(cast.spawn(person({ id: someone('guard', 'heavy'), role: 'guard', appearance: { base, variant: 1 } })))
      const ratio = (key: keyof typeof heavy) => heavy[key] / regular[key]
      expect(ratio('shoulders'), `${base}: the shoulders went ${regular.shoulders.toFixed(3)} to ${heavy.shoulders.toFixed(3)} m`).toBeGreaterThan(1.12)
      expect(ratio('chest'), `${base}: the chest went ${regular.chest.toFixed(3)} to ${heavy.chest.toFixed(3)} m off the spine`).toBeGreaterThan(1.1)
      expect(ratio('upperArm'), `${base}: the upper arm went ${regular.upperArm.toFixed(3)} to ${heavy.upperArm.toFixed(3)} m thick`).toBeGreaterThan(1.12)
      expect(ratio('height'), `${base}: the height went ${regular.height.toFixed(3)} to ${heavy.height.toFixed(3)} m`).toBeGreaterThan(1.03)
      expect(ratio('height'), `${base}: the height went ${regular.height.toFixed(3)} to ${heavy.height.toFixed(3)} m`).toBeLessThan(1.06)
      // the head is not part of the build: it grows with the height and no more
      expect(ratio('head'), `${base}: the head went ${regular.head.toFixed(3)} to ${heavy.head.toFixed(3)} m`).toBeLessThan(1.06)
    }
  })

  it('keeps its feet where the regular feet are, its hips on the same seat and its clothes on, through every clip', () => {
    // one id for both, so the twins are at the same point of every loop
    const id = someone('worker', 'heavy')
    const heavy = cast.spawn(person({ id, role: 'worker' }))
    const regular = cast.spawn(person({ id, role: 'clerk' }))
    expect(heavy.build).toBe('heavy')
    expect(regular.build).toBe('regular')
    for (const clip of clipsUsed()) {
      heavy.play(clip, 0)
      regular.play(clip, 0)
      for (let step = 0; step <= 8; step++) {
        cast.update(step === 0 ? 0.001 : 0.3)
        const bounds = posedBounds(heavy.object)
        const size = bounds.getSize(new THREE.Vector3())
        expect(size.x, `${clip}: a vertex flew off sideways`).toBeLessThan(2.2)
        expect(size.z, `${clip}: a vertex flew off forwards`).toBeLessThan(2.2)
        // the lowest point is the regular body's lowest point: a foot on the
        // floor, a foot in flight, a sole on the stool's rail, a back on the mattress
        const lowest = bounds.min.y - posedBounds(regular.object).min.y
        expect(Math.abs(lowest), `${clip}: the heavy body's lowest point is ${lowest.toFixed(3)} m off the regular one's`).toBeLessThan(0.02)
        // a body on a pad sits on the same pad: the extra height goes into the give, not the air
        if ((clip.startsWith('Sitting_') && clip.endsWith('_Loop')) || clip === 'Sleep_Loop') {
          const hips = joint(heavy, 'pelvis').y - joint(regular, 'pelvis').y
          expect(Math.abs(hips), `${clip}: the heavy hips are ${hips.toFixed(3)} m off the regular ones`).toBeLessThan(0.03)
        }
      }
    }
  })

  it('holds what is in its hand where the regular body holds it: at the ear, at the lips', () => {
    // one id for both, so the twins are at the same point of every loop
    const id = someone('worker', 'heavy')
    for (const clip of Object.keys(HANDHELD)) {
      const pair = { heavy: cast.spawn(person({ id, role: 'worker' }), clip), regular: cast.spawn(person({ id, role: 'clerk' }), clip) }
      const nearest = { heavy: Infinity, regular: Infinity }
      for (let step = 0; step <= 20; step++) {
        cast.update(step === 0 ? 0.001 : 0.1)
        for (const build of ['heavy', 'regular'] as const) {
          const thing = pair[build].object.getObjectByName(HANDHELD[clip]!.prop)!.getWorldPosition(new THREE.Vector3())
          nearest[build] = Math.min(nearest[build], offTheHead(pair[build], thing))
        }
      }
      // a thing the clip brings to the face: the wider shoulders must not carry it off the ear or through the cheek
      if (nearest.regular > 0.1) continue
      const drift = Math.abs(nearest.heavy - nearest.regular)
      expect(drift, `${clip}: the ${HANDHELD[clip]!.prop} sits ${nearest.heavy.toFixed(3)} m off the head, against ${nearest.regular.toFixed(3)}`).toBeLessThan(0.03)
    }
  })

  it('leans on the wall the same anchor serves, and props a heavy body no further back than the published standoff', () => {
    const STANDOFF = 0.44
    for (const base of BODIES) {
      const member = cast.spawn(person({ id: someone('guard', 'heavy'), role: 'guard', appearance: { base, variant: 1 } }), 'Idle_Wall_Loop')
      for (let step = 0; step <= 12; step++) {
        cast.update(step === 0 ? 0.001 : 0.2)
        const back = posedBounds(member.object).max.z
        expect(back, `${base} reaches ${back.toFixed(3)} m behind the anchor`).toBeLessThan(STANDOFF)
      }
    }
    expect(METRICS.furniture.seatHeight).toBeGreaterThan(0)
  })
})
