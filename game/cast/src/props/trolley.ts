import * as THREE from 'three'

/**
 * A cage trolley pushed along in front, in the body's own frame (+Z ahead).
 * `Push_Loop` holds both hands at 1.17 m up and 0.58 m ahead, 0.21 m either
 * side of the middle, so the handle runs through them and the cage stands
 * beyond it.
 */
const HANDLE_HEIGHT = 1.165
const HANDLE_AHEAD = 0.58
const HALF_WIDTH = 0.28
const CAGE_LENGTH = 0.7
const CAGE_TOP = 0.95
const DECK = 0.12
const WHEEL = 0.06

const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.6 })
const rubber = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 })

export function buildTrolley(): THREE.Object3D {
  const trolley = new THREE.Group()
  trolley.name = 'trolley'
  const bar = (length: number, along: 'x' | 'y' | 'z', at: [number, number, number]) => {
    const size: [number, number, number] = [0.025, 0.025, 0.025]
    size[along === 'x' ? 0 : along === 'y' ? 1 : 2] = length
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), steel)
    mesh.position.set(...at)
    trolley.add(mesh)
  }
  const front = HANDLE_AHEAD + CAGE_LENGTH
  // the handle and its two uprights
  bar(HALF_WIDTH * 2, 'x', [0, HANDLE_HEIGHT, HANDLE_AHEAD])
  for (const side of [-1, 1]) {
    bar(HANDLE_HEIGHT - DECK, 'y', [side * HALF_WIDTH, (HANDLE_HEIGHT + DECK) / 2, HANDLE_AHEAD])
    bar(CAGE_TOP - DECK, 'y', [side * HALF_WIDTH, (CAGE_TOP + DECK) / 2, front])
    bar(CAGE_LENGTH, 'z', [side * HALF_WIDTH, CAGE_TOP, HANDLE_AHEAD + CAGE_LENGTH / 2])
    bar(CAGE_LENGTH, 'z', [side * HALF_WIDTH, (CAGE_TOP + DECK) / 2, HANDLE_AHEAD + CAGE_LENGTH / 2])
  }
  bar(HALF_WIDTH * 2, 'x', [0, CAGE_TOP, front])
  const deck = new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2, 0.03, CAGE_LENGTH), steel)
  deck.position.set(0, DECK, HANDLE_AHEAD + CAGE_LENGTH / 2)
  trolley.add(deck)
  for (const side of [-1, 1]) {
    for (const end of [HANDLE_AHEAD + 0.08, front - 0.08]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL, WHEEL, 0.03, 12), rubber)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(side * (HALF_WIDTH - 0.03), WHEEL, end)
      trolley.add(wheel)
    }
  }
  return trolley
}
