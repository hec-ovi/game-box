import * as THREE from 'three'

/**
 * Rewrites a mesh's UVs so one texture unit is one metre, read off where each
 * vertex lands in the frame the mesh stands in: a floor or a ceiling is laid
 * out on the ground (`u` east, `v` south), a wall runs along itself (`u`) and
 * climbs (`v`). A texture with `repeat` 1 then tiles every metre whatever size
 * the room is, and the grain runs on from one wall into the next.
 */
export function metreUvs(mesh: THREE.Mesh): void {
  mesh.updateMatrix()
  const geometry = mesh.geometry
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const turn = new THREE.Matrix3().getNormalMatrix(mesh.matrix)
  const point = new THREE.Vector3()
  const facing = new THREE.Vector3()
  const uv = new Float32Array(position.count * 2)

  for (let at = 0; at < position.count; at++) {
    point.fromBufferAttribute(position, at).applyMatrix4(mesh.matrix)
    facing.fromBufferAttribute(normal, at).applyMatrix3(turn)
    const [u, v] = axesOf(facing, point)
    uv[at * 2] = u
    uv[at * 2 + 1] = v
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/** Which two of a point's coordinates a face that way is textured by. */
function axesOf(facing: THREE.Vector3, point: THREE.Vector3): [number, number] {
  const x = Math.abs(facing.x)
  const y = Math.abs(facing.y)
  const z = Math.abs(facing.z)
  if (y >= x && y >= z) return [point.x, point.z]
  if (x >= z) return [point.z, point.y]
  return [point.x, point.y]
}
