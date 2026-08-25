import * as THREE from 'three'
import { palmOf } from './hand.ts'

/** 75 x 155 x 10 mm, the screen lit. */
const WIDTH = 0.075
const HEIGHT = 0.155
const THICK = 0.01

/** How far the back of the phone sits off the wrist bone, out through the palm. */
const IN_THE_PALM = 0.03

const body = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.35, metalness: 0.4 })
const screen = new THREE.MeshStandardMaterial({
  color: 0x0a0c10,
  emissive: new THREE.Color(0x9fd8ff),
  emissiveIntensity: 1.6,
  roughness: 0.2,
})

/**
 * A phone lying along the fingers with its back in the palm and its screen
 * facing out through it, which on a hand at the ear is toward the ear.
 */
export function buildPhone(bone: 'hand_l' | 'hand_r'): THREE.Object3D {
  const palm = palmOf(bone)
  const phone = new THREE.Group()
  phone.name = 'phone'
  const slab = new THREE.Mesh(new THREE.BoxGeometry(THICK, HEIGHT, WIDTH), body)
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.001, HEIGHT * 0.9, WIDTH * 0.86), screen)
  face.position.x = (palm * (THICK + 0.001)) / 2
  phone.add(slab, face)
  phone.position.set(palm * IN_THE_PALM, HEIGHT / 2 - 0.005, 0)
  return phone
}
