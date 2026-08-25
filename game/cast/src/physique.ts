import * as THREE from 'three'
import type { Build } from './build.ts'

/**
 * The heavy build, as what is done to one cloned rig at spawn. Every number is
 * a ratio over the pack's body; `tests/build.test.ts` measures what they come
 * to on the skin.
 */
const HEAVY = {
  /** Across the torso bones, X and Z of each: Y runs along the spine. */
  torso: 1.12,
  /** Across the upper arms. */
  upperArms: 1.16,
  /** How much further out along the clavicle the shoulder joint sits. */
  shoulders: 1.15,
  /** The whole body, root to crown. */
  height: 1.04,
}

const TORSO = ['spine_01', 'spine_02', 'spine_03']
const UPPER_ARMS = ['upperarm_l', 'upperarm_r']
const SHOULDERS: ReadonlyArray<readonly [string, string]> = [
  ['clavicle_l', 'upperarm_l'],
  ['clavicle_r', 'upperarm_r'],
]

/**
 * Shapes a rig to a build. A bone's scale is kept to its own skin: what hangs
 * off it is moved under a group scaled by the inverse, so a thicker chest
 * does not shear the arms swinging off it and every clip plays as authored.
 * The shoulders go wider by moving the upper-arm joints out along the
 * clavicles; the clip writes each joint's own offset every frame, and the
 * group under the clavicle carries the extra.
 */
export function shape(body: THREE.Object3D, build: Build): void {
  if (build !== 'heavy') return
  const bones = new Map<string, THREE.Object3D>()
  body.traverse((child) => {
    if ((child as THREE.Bone).isBone) bones.set(child.name, child)
  })
  for (const name of TORSO) thicken(bones.get(name), HEAVY.torso)
  for (const name of UPPER_ARMS) thicken(bones.get(name), HEAVY.upperArms)
  for (const [clavicle, upperarm] of SHOULDERS) widen(bones.get(clavicle), bones.get(upperarm), HEAVY.shoulders)
  // the root's own translation is the clip's (a lift onto a stool, a mattress)
  // and stays as authored: the body grows about it
  bones.get('root')?.scale.multiplyScalar(HEAVY.height)
}

/** Scales a bone across its length, and shields everything under it from the scale. */
function thicken(bone: THREE.Object3D | undefined, across: number): void {
  if (!bone) return
  const under = new THREE.Group()
  under.scale.set(1 / across, 1, 1 / across)
  for (const child of [...bone.children]) under.add(child)
  bone.add(under)
  bone.scale.set(across, 1, across)
}

/** Moves the joint at the end of a bone further out along it. */
function widen(bone: THREE.Object3D | undefined, joint: THREE.Object3D | undefined, by: number): void {
  if (!bone || !joint || joint.parent !== bone) return
  const out = new THREE.Group()
  out.position.copy(joint.position).multiplyScalar(by - 1)
  out.add(joint)
  bone.add(out)
}
