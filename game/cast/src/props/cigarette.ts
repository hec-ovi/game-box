import * as THREE from 'three'

const LENGTH = 0.085
const RADIUS = 0.004

/**
 * Where the second knuckles of the index and middle fingers meet on the right
 * hand, and the way from there to the middle of the head, both in the hand's
 * own frame; measured on `Idle_WallSmoke_Loop`, whose fingertips rest on the
 * lips. The cigarette runs through that gap toward the mouth.
 */
const BETWEEN_THE_FINGERS = new THREE.Vector3(-0.042, 0.129, 0.018)
const TOWARD_THE_MOUTH = new THREE.Vector3(0.93, 0.07, 0.35).normalize()

const paper = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 })
const ember = new THREE.MeshStandardMaterial({
  color: 0x2a1a10,
  emissive: new THREE.Color(0xff5a1c),
  emissiveIntensity: 2.2,
})

export function buildCigarette(): THREE.Object3D {
  const cigarette = new THREE.Group()
  cigarette.name = 'cigarette'
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, LENGTH, 8), paper)
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, 0.006, 8), ember)
  // the lit end is the one away from the mouth
  tip.position.y = -LENGTH / 2
  cigarette.add(stick, tip)
  cigarette.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), TOWARD_THE_MOUTH)
  // the filter sits at the fingers, the rest runs out away from the face
  cigarette.position.copy(BETWEEN_THE_FINGERS).addScaledVector(TOWARD_THE_MOUTH, -LENGTH / 2)
  return cigarette
}
