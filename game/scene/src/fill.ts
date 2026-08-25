import * as THREE from 'three'

/**
 * What a face looking down is lit by, as the irradiance a white surface gets.
 * Nothing else in the game reaches one: the sky's lower half is black by
 * design, and a room's own light strips are emissive geometry. A ceiling reads
 * its colour times this over pi, the same way the sun lights the floor.
 */
export const CEILING_FILL = 1.6

/**
 * Light for the ceiling: one light shining straight up from the floor, so a
 * face is lit by how far it looks down and a wall or a floor gets nothing. A
 * bounce off the floor is what this stands in for, and it is a light and not a
 * probe because a probe bright enough to do this would flood the room.
 */
export function ceilingFill(root: THREE.Object3D): THREE.DirectionalLight {
  const fill = new THREE.DirectionalLight(0xffffff, CEILING_FILL)
  fill.name = 'fill'
  fill.position.set(0, -1, 0)
  // the target rides in the same frame as the light, so the direction stays
  // straight up wherever the room is put
  root.add(fill)
  root.add(fill.target)
  return fill
}
