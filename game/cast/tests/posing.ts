import * as THREE from 'three'

/**
 * Where a skinned mesh's vertices actually land once the pose is applied. The
 * renderer does this on the GPU, so a test that wants to know whether an elbow
 * is inside a head has to redo the same sum here: for a glTF character the
 * world position of a vertex is the weighted sum of its bones' world matrices
 * times their inverse bind matrices.
 */
export interface Skin {
  readonly mesh: THREE.SkinnedMesh
  readonly position: THREE.BufferAttribute
  readonly index: THREE.BufferAttribute
  readonly weight: THREE.BufferAttribute
}

export function skinsOf(object: THREE.Object3D): Skin[] {
  const out: Skin[] = []
  object.updateMatrixWorld(true)
  object.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    out.push({
      mesh,
      position: mesh.geometry.getAttribute('position') as THREE.BufferAttribute,
      index: mesh.geometry.getAttribute('skinIndex') as THREE.BufferAttribute,
      weight: mesh.geometry.getAttribute('skinWeight') as THREE.BufferAttribute,
    })
  })
  return out
}

const rest = new THREE.Vector3()
const step = new THREE.Vector3()
const bone = new THREE.Matrix4()

/** One vertex in world space. Call after `updateMatrixWorld`. */
export function posed(skin: Skin, vertex: number, into = new THREE.Vector3()): THREE.Vector3 {
  rest.fromBufferAttribute(skin.position, vertex).applyMatrix4(skin.mesh.bindMatrix)
  into.set(0, 0, 0)
  for (let slot = 0; slot < 4; slot++) {
    const share = skin.weight.getComponent(vertex, slot)
    if (!share) continue
    const joint = skin.index.getComponent(vertex, slot)
    bone.multiplyMatrices(skin.mesh.skeleton.bones[joint]!.matrixWorld, skin.mesh.skeleton.boneInverses[joint]!)
    into.add(step.copy(rest).applyMatrix4(bone).multiplyScalar(share))
  }
  return into
}

/** The bone that moves this vertex most, which is what makes it part of a head or an arm. */
export function ownerOf(skin: Skin, vertex: number): string {
  let best = -1
  let most = 0
  for (let slot = 0; slot < 4; slot++) {
    const share = skin.weight.getComponent(vertex, slot)
    if (share <= most) continue
    most = share
    best = skin.index.getComponent(vertex, slot)
  }
  return skin.mesh.skeleton.bones[best]?.name ?? ''
}

/** Every vertex of a visible mesh whose owning bone matches, as (skin, vertex) pairs. */
export function partsOf(skins: readonly Skin[], bones: RegExp): Array<{ skin: Skin; vertex: number; bone: string }> {
  const out: Array<{ skin: Skin; vertex: number; bone: string }> = []
  for (const skin of skins) {
    if (!skin.mesh.visible) continue
    for (let vertex = 0; vertex < skin.position.count; vertex++) {
      const owner = ownerOf(skin, vertex)
      if (bones.test(owner)) out.push({ skin, vertex, bone: owner })
    }
  }
  return out
}

/** The world-space box a posed character fills. */
export function posedBounds(object: THREE.Object3D): THREE.Box3 {
  object.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const point = new THREE.Vector3()
  for (const skin of skinsOf(object)) {
    if (!skin.mesh.visible) continue
    for (let vertex = 0; vertex < skin.position.count; vertex++) box.expandByPoint(posed(skin, vertex, point))
  }
  return box
}

/** The ball the head fills, in world space. */
export function headSphere(head: ReadonlyArray<{ skin: Skin; vertex: number }>): THREE.Sphere {
  const centre = new THREE.Vector3()
  const point = new THREE.Vector3()
  for (const one of head) centre.add(posed(one.skin, one.vertex, point))
  centre.divideScalar(head.length)
  let radius = 0
  for (const one of head) radius = Math.max(radius, posed(one.skin, one.vertex, point).distanceTo(centre))
  return new THREE.Sphere(centre, radius)
}
