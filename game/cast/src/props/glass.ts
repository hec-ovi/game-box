import * as THREE from 'three'
import { alongTheKnuckles, palmOf } from './hand.ts'

const RADIUS = 0.033
const HEIGHT = 0.1

/** How far the glass's axis sits off the wrist bone, out through the palm. */
const IN_THE_GRIP = 0.038

const glass = new THREE.MeshPhysicalMaterial({
  color: 0xdfe8ee,
  roughness: 0.05,
  metalness: 0,
  transparent: true,
  opacity: 0.35,
  transmission: 0,
})
const drink = new THREE.MeshStandardMaterial({ color: 0x7a3a10, roughness: 0.3, transparent: true, opacity: 0.85 })

/**
 * A tumbler held by the fingers wrapped round it: its axis runs across the
 * knuckles, the top toward the index finger, which the drink clips carry
 * upright when the hand comes up to the mouth.
 */
export function buildGlass(bone: 'hand_l' | 'hand_r'): THREE.Object3D {
  const tumbler = new THREE.Group()
  tumbler.name = 'glass'
  const shell = alongTheKnuckles(new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS * 0.88, HEIGHT, 16, 1, true), glass))
  const base = alongTheKnuckles(new THREE.Mesh(new THREE.CylinderGeometry(RADIUS * 0.88, RADIUS * 0.88, 0.006, 16), glass))
  base.position.z = -HEIGHT / 2
  const fill = alongTheKnuckles(new THREE.Mesh(new THREE.CylinderGeometry(RADIUS * 0.92, RADIUS * 0.82, HEIGHT * 0.55, 16), drink))
  fill.position.z = -HEIGHT * 0.2
  tumbler.add(shell, base, fill)
  tumbler.position.set(palmOf(bone) * IN_THE_GRIP, 0.075, 0)
  return tumbler
}
