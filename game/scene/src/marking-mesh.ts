import * as THREE from 'three'
import type { Dressing } from './dressing.ts'
import { PAINT_COLOUR, type Marking, type MarkingPaint } from './markings.ts'

/** The paints a street uses, in the order they are laid down. */
const PAINTS: readonly MarkingPaint[] = ['white', 'yellow']

/**
 * Every marking of one paint in one instanced mesh, so the whole city's street
 * markings cost one draw per paint however many streets it has. Each instance
 * is the same square metre of road, moved, turned and stretched into place.
 */
export function markingMeshes(markings: readonly Marking[], dressing: Dressing): THREE.InstancedMesh[] {
  const meshes: THREE.InstancedMesh[] = []
  for (const paint of PAINTS) {
    const of = markings.filter((marking) => marking.paint === paint)
    if (of.length) meshes.push(painted(paint, of, dressing))
  }
  return meshes
}

function painted(paint: MarkingPaint, markings: readonly Marking[], dressing: Dressing): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(slab(), material(paint, dressing), markings.length)
  mesh.name = `markings:${paint}`
  mesh.receiveShadow = true
  mesh.castShadow = false

  const matrix = new THREE.Matrix4()
  const turn = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  markings.forEach((marking, index) => {
    turn.setFromAxisAngle(up, marking.rot)
    matrix.compose(
      new THREE.Vector3(marking.x, marking.y, marking.z),
      turn,
      new THREE.Vector3(marking.width, 1, marking.length),
    )
    mesh.setMatrixAt(index, matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

/** One square metre lying on the road, looking up, its uv running 0 to 1 across the paint. */
function slab(): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
}

function material(paint: MarkingPaint, dressing: Dressing): THREE.Material {
  return dressing.marking?.(paint) ?? new THREE.MeshStandardMaterial({ color: PAINT_COLOUR[paint], roughness: 0.7, metalness: 0 })
}
