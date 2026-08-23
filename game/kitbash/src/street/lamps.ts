import type { World } from '@gb/world'
import * as THREE from 'three'
import type { KitLibrary } from '../kit/library.ts'
import { districtsOf } from './districts.ts'
import { LAMP_ATTRIBUTES } from './lamp/design.ts'
import { buildHaloes } from './lamp/halo.ts'
import { lampMaterial } from './lamp/material.ts'
import { lampGeometry } from './lamp/model.ts'
import { lampsFor, type Lamp } from './lamp/variants.ts'
import { lampSpots } from './layout.ts'

/**
 * Every street lamp in the city: the posts one instanced draw to a district,
 * and every halo in one additive quad buffer. Both read the same `CityNight`,
 * so they come on together and cost nothing to move through the evening.
 *
 * The posts are cut into districts because one bounding volume over the whole
 * town can never be culled: standing on one street you would pay for the lamps
 * on every other, in the shadow pass as well as the frame. A district's worth
 * is one volume the frustum can throw away.
 *
 * The lamp is generated rather than loaded, so every kit lights its streets and
 * every lamp can differ from the one before it: one buffer holds every fitting,
 * the district holds which lamp carries which, and the material collapses the
 * rest. A town with no kerb in it gives an empty group.
 */
export function buildStreetLamps(world: World, kit: KitLibrary, spacing?: number): THREE.Group {
  const group = new THREE.Group()
  group.name = 'kit:streetlights'

  const lamps = lampsFor(lampSpots(world, spacing), world.seed)
  if (lamps.length === 0) return group

  const geometry = lampGeometry()
  // one material and one set of vertices for the whole city: a district is a
  // bounding volume and a list of lamps, not a look
  const material = lampMaterial(kit.night)
  for (const [at, district] of districtsOf(lamps).entries()) group.add(posts(geometry, material, district.of, at))
  group.add(buildHaloes(lamps, kit.night))
  return group
}

/** The posts of one district: one instanced draw, one bounding volume. */
function posts(shared: THREE.BufferGeometry, material: THREE.Material, lamps: readonly Lamp[], district: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(chunk(shared, lamps), material, lamps.length)
  mesh.name = `kit:streetlights:posts:${district}`
  mesh.castShadow = true
  mesh.receiveShadow = true

  const matrix = new THREE.Matrix4()
  const turn = new THREE.Quaternion()
  const axis = new THREE.Vector3(0, 1, 0)
  const at = new THREE.Vector3()
  const size = new THREE.Vector3()
  lamps.forEach((lamp, index) => {
    at.set(lamp.x, 0, lamp.z)
    turn.setFromAxisAngle(axis, lamp.rotationY)
    mesh.setMatrixAt(index, matrix.compose(at, turn, size.setScalar(lamp.scale)))
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

/**
 * One district's geometry: the city's one set of lamp vertices, with this
 * district's own per-lamp data beside it. The vertex attributes are the same
 * objects in every district, so the town has one vertex buffer however many
 * districts it is cut into.
 */
function chunk(shared: THREE.BufferGeometry, lamps: readonly Lamp[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  for (const [name, attribute] of Object.entries(shared.attributes)) geometry.setAttribute(name, attribute)
  geometry.setIndex(shared.getIndex())

  const variant = new Float32Array(lamps.length * 2)
  const base = new Float32Array(lamps.length * 3)
  lamps.forEach((lamp, index) => {
    variant.set([lamp.kit, lamp.tint], index * 2)
    base.set([lamp.x, 0, lamp.z], index * 3)
  })
  geometry.setAttribute(LAMP_ATTRIBUTES.variant, new THREE.InstancedBufferAttribute(variant, 2))
  geometry.setAttribute(LAMP_ATTRIBUTES.base, new THREE.InstancedBufferAttribute(base, 3))
  return geometry
}
