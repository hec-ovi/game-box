import type * as THREE from 'three'

/**
 * The frame of a hand bone on this rig, measured in `tests/props.test.ts`:
 * +Y runs down the fingers from the wrist, Z runs across the knuckles (the
 * index finger at +Z, the little finger at -Z on both hands), and the palm
 * faces -X on the right hand and +X on the left. A grip is written against
 * those axes so the same offsets serve any clip that holds the thing.
 */
/** Which way the palm faces on a hand: the sign of X. */
export function palmOf(bone: 'hand_l' | 'hand_r'): number {
  return bone === 'hand_r' ? -1 : 1
}

/** A `CylinderGeometry` runs along +Y; this turns a mesh so it runs along +Z instead. */
export function alongTheKnuckles(mesh: THREE.Mesh): THREE.Mesh {
  mesh.rotation.x = Math.PI / 2
  return mesh
}
