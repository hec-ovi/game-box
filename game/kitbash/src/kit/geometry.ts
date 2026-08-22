import * as THREE from 'three'

type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute

/**
 * One geometry in the shape everything here merges: plain float position,
 * normal and UV, indexed, and nothing else on it.
 *
 * Two geometries weld into one mesh only when they agree attribute for
 * attribute, down to the array type, and a kit export is uneven: the shipped
 * pack is quantized (positions as normalized 16-bit ints, which a placement
 * matrix would clip to -1..1), carries vertex colours and a second UV set on
 * some meshes, and no UVs at all on others.
 *
 * The source has to have a position attribute: callers drop meshes with
 * nothing in them before asking.
 */
export function canonical(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = source.getAttribute('position')
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', floats(position, position.count, 3))
  geometry.setAttribute('normal', floats(source.getAttribute('normal'), position.count, 3))
  geometry.setAttribute('uv', floats(source.getAttribute('uv'), position.count, 2))
  const index = source.getIndex()
  geometry.setIndex(new THREE.BufferAttribute(index ? Uint32Array.from(index.array) : counting(position.count), 1))
  return geometry
}

/**
 * One attribute as plain floats. Reading through the accessors is what
 * dequantizes it: a normalized 16-bit position comes back in metres, a
 * normalized 8-bit normal comes back as a unit vector.
 */
function floats(source: Attribute | undefined, count: number, itemSize: number): THREE.BufferAttribute {
  const array = new Float32Array(count * itemSize)
  if (!source) return new THREE.BufferAttribute(array, itemSize)

  const size = Math.min(itemSize, source.itemSize)
  for (let vertex = 0; vertex < count; vertex++) {
    const at = vertex * itemSize
    if (size > 0) array[at] = source.getX(vertex)
    if (size > 1) array[at + 1] = source.getY(vertex)
    if (size > 2) array[at + 2] = source.getZ(vertex)
  }
  return new THREE.BufferAttribute(array, itemSize)
}

/** 0, 1, 2, ...: the index an unindexed geometry implies. */
function counting(count: number): Uint32Array {
  const array = new Uint32Array(count)
  for (let i = 0; i < count; i++) array[i] = i
  return array
}
