import * as THREE from 'three'

/** One mesh of an object, brought into that object's own frame. */
export interface Part {
  readonly geometry: THREE.BufferGeometry
  readonly material: THREE.Material
  readonly castShadow: boolean
  readonly receiveShadow: boolean
}

/** Object types that draw nothing, so an object carrying one is still batchable. */
const MARKERS = new Set(['Object3D', 'Group', 'Bone'])

/**
 * Takes an object apart into the meshes a batch can hold.
 *
 * A batch holds indexed, single-material meshes and nothing else. An object
 * carrying anything a batch cannot draw the same way (an instanced mesh, a
 * sprite, a light, a mesh cut into material groups) is refused whole rather
 * than half taken, so a dressing may return whatever it likes and the worst
 * that happens is its object stands on its own.
 *
 * Geometry comes back in the object's frame: a mesh sitting off the origin
 * inside it is baked, so the batch only ever has to place the object itself.
 */
export function partsOf(object: THREE.Object3D): Part[] | undefined {
  object.updateMatrixWorld(true)
  const inverse = object.matrixWorld.clone().invert()
  const parts: Part[] = []
  let refused = false

  object.traverse((child) => {
    if (refused) return
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) {
      // an empty or a group carries nothing to draw; anything else does
      if (!MARKERS.has(child.type)) refused = true
      return
    }
    if ((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh || Array.isArray(mesh.material) || !mesh.geometry.getIndex()) {
      refused = true
      return
    }
    const local = inverse.clone().multiply(mesh.matrixWorld)
    parts.push({
      geometry: isIdentity(local) ? mesh.geometry : mesh.geometry.clone().applyMatrix4(local),
      material: mesh.material,
      castShadow: mesh.castShadow,
      receiveShadow: mesh.receiveShadow,
    })
  })

  return refused ? undefined : parts
}

const IDENTITY = new THREE.Matrix4()

function isIdentity(matrix: THREE.Matrix4): boolean {
  return matrix.equals(IDENTITY)
}
