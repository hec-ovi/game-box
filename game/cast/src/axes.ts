import * as THREE from 'three'

/** A bone with, in its own frame, the way the rest pose faces and which way is up. */
export interface BoneAxes {
  readonly bone: THREE.Bone
  readonly forward: THREE.Vector3
  readonly up: THREE.Vector3
  readonly right: THREE.Vector3
}

/**
 * Reads the axes of some bones off the rest pose, so a layer that turns a
 * head takes its "left" and "down" from the rig rather than a guess. Call it
 * before anything animates; bones the rig has not got are left out.
 */
export function restAxesOf(root: THREE.Object3D, names: readonly string[]): BoneAxes[] {
  root.updateMatrixWorld(true)
  const model = root.getWorldQuaternion(new THREE.Quaternion()).invert()
  const bones = new Map<string, THREE.Bone>()
  root.traverse((child) => {
    if ((child as THREE.Bone).isBone) bones.set(child.name, child as THREE.Bone)
  })

  const out: BoneAxes[] = []
  for (const name of names) {
    const bone = bones.get(name)
    if (!bone) continue
    // the rest pose faces the model's +Z with +Y up; expressed in the bone's
    // own frame those become the axes an offset turns around
    const rest = model.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion())).invert()
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rest)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rest)
    const right = new THREE.Vector3().crossVectors(up, forward)
    out.push({ bone, forward, up, right })
  }
  return out
}
