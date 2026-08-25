import * as THREE from 'three'
import { alongTheKnuckles, palmOf } from './hand.ts'

const RADIUS = 0.028
const LENGTH = 0.1

/** How far the roll's axis sits off the wrist bone, out through the palm: the same grip as the glass. */
const IN_THE_GRIP = 0.038

const bread = new THREE.MeshStandardMaterial({ color: 0xc9924f, roughness: 0.85 })
const filling = new THREE.MeshStandardMaterial({ color: 0x6d3b22, roughness: 0.7 })
const paper = new THREE.MeshStandardMaterial({ color: 0xe8e2d3, roughness: 0.95 })

/**
 * A filled roll in a paper wrap, held the way the glass is: its axis across
 * the knuckles, the open end toward the index finger, which the eating clip
 * brings to the mouth.
 */
export function buildFood(bone: 'hand_l' | 'hand_r'): THREE.Object3D {
  const roll = new THREE.Group()
  roll.name = 'food'
  const bun = alongTheKnuckles(new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS * 0.9, LENGTH, 12), bread))
  const meat = alongTheKnuckles(new THREE.Mesh(new THREE.CylinderGeometry(RADIUS * 0.7, RADIUS * 0.7, LENGTH + 0.008, 10), filling))
  const wrap = alongTheKnuckles(new THREE.Mesh(new THREE.CylinderGeometry(RADIUS * 1.08, RADIUS * 1.0, LENGTH * 0.6, 12, 1, true), paper))
  // the wrap covers the end in the hand and leaves the end at the mouth open
  wrap.position.z = -LENGTH * 0.2
  roll.add(bun, meat, wrap)
  roll.position.set(palmOf(bone) * IN_THE_GRIP, 0.075, 0)
  return roll
}
