import * as THREE from 'three'
import { alongTheKnuckles, palmOf } from './hand.ts'

const GRIP = 0.12
const TUBE = 0.2
const RADIUS = 0.016

/** How far the torch's axis sits off the wrist bone, out through the palm. */
const IN_THE_GRIP = 0.032

const handle = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.6, metalness: 0.3 })
const light = new THREE.MeshStandardMaterial({
  color: 0x203038,
  emissive: new THREE.Color(0x8ff4ff),
  emissiveIntensity: 2.4,
})

/**
 * A hand light: a grip in the fist and a lit tube standing up out of it. The
 * torch clip holds the hand as if round a flaming torch, thumb up, so the
 * tube runs across the knuckles toward the index finger, which that clip
 * carries straight up.
 */
export function buildTorch(bone: 'hand_l' | 'hand_r'): THREE.Object3D {
  const torch = new THREE.Group()
  torch.name = 'torch'
  const grip = alongTheKnuckles(new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, GRIP, 12), handle))
  const tube = alongTheKnuckles(new THREE.Mesh(new THREE.CylinderGeometry(RADIUS * 0.8, RADIUS * 0.8, TUBE, 12), light))
  tube.position.z = GRIP / 2 + TUBE / 2
  torch.add(grip, tube)
  torch.position.set(palmOf(bone) * IN_THE_GRIP, 0.07, 0)
  return torch
}
