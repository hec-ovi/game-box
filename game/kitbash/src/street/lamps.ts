import type { World } from '@gb/world'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { attribute, float, smoothstep, uv, vec2, vec3 } from 'three/tsl'
import { MeshStandardNodeMaterial, SpriteNodeMaterial } from 'three/webgpu'
import { LAMP, LAMP_LENS, LAMP_POST } from '../catalog/furniture.ts'
import type { KitLibrary } from '../kit/library.ts'
import type { CityNight } from '../night/night.ts'
import type { Vec3Node } from '../night/nodes.ts'
import { districtsOf } from './districts.ts'
import { lampSpots, type LampSpot } from './layout.ts'

/** Which part of the lamp a vertex is on, baked so one material shades both. */
const PART = { post: 0, lens: 1 } as const
const PART_ATTRIBUTE = 'lampPart'

/** How much brighter than its own colour a lit lantern burns. */
const LENS_GLOW = 5

/** The colour of the light itself, and how far its halo carries, in metres. */
const HALO = { colour: 0xffc47a, radius: 3 }

/**
 * Every street lamp in the city: the posts one instanced draw to a district,
 * and every halo in one additive quad buffer. Both read the same `CityNight`,
 * so they come on together and cost nothing to move through the evening.
 *
 * The posts are cut into districts because a kit lamp is a thousand triangles
 * and one bounding volume over the whole town can never be culled: standing on
 * one street you would pay for the lamps on every other, in the shadow pass as
 * well as the frame. A district's worth is one volume the frustum can throw
 * away. The haloes stay in one buffer, because two triangles a lamp is not
 * worth a draw of its own to cull.
 *
 * A pack with no lamp in it gives an empty group rather than a stand-in, and
 * the street simply stays dark.
 */
export function buildStreetLamps(world: World, kit: KitLibrary, spacing?: number): THREE.Group {
  const group = new THREE.Group()
  group.name = 'kit:streetlights'
  if (!kit.has(LAMP)) return group

  const spots = lampSpots(world, spacing)
  if (spots.length === 0) return group

  const geometry = lampGeometry(kit)
  // one material for the whole city: a district is a bounding volume, not a look
  const post = lampMaterial(kit)
  for (const [at, district] of districtsOf(spots).entries()) group.add(posts(geometry, post, district.of, at))
  group.add(haloes(spots, lanternHeight(geometry), kit.night))
  return group
}

/** The whole lamp as one buffer, every vertex knowing which part it is on. */
function lampGeometry(kit: KitLibrary): THREE.BufferGeometry {
  const parts = kit.parts(LAMP).map((part) => {
    const geometry = part.geometry.clone()
    const count = geometry.getAttribute('position').count
    const which = new Float32Array(count).fill(part.material === LAMP_LENS ? PART.lens : PART.post)
    geometry.setAttribute(PART_ATTRIBUTE, new THREE.BufferAttribute(which, 1))
    return geometry
  })
  const merged = parts.length === 1 ? parts[0]! : mergeGeometries(parts)
  if (!merged) throw new Error('kitbash: the lamp\'s parts do not share one set of vertex attributes')
  if (parts.length > 1) for (const part of parts) part.dispose()
  return merged
}

/** Where the lantern sits above the pavement, measured off the lamp itself. */
function lanternHeight(geometry: THREE.BufferGeometry): number {
  const part = geometry.getAttribute(PART_ATTRIBUTE)
  const position = geometry.getAttribute('position')
  let low = Infinity
  let high = -Infinity
  for (let at = 0; at < part.count; at++) {
    if (part.getX(at) !== PART.lens) continue
    low = Math.min(low, position.getY(at))
    high = Math.max(high, position.getY(at))
  }
  return Number.isFinite(low) ? (low + high) / 2 : 0
}

/** The posts of one district: one instanced draw, one bounding volume. */
function posts(geometry: THREE.BufferGeometry, material: THREE.Material, spots: readonly LampSpot[], district: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length)
  mesh.name = `kit:streetlights:posts:${district}`
  mesh.castShadow = true
  mesh.receiveShadow = true

  const matrix = new THREE.Matrix4()
  const turn = new THREE.Quaternion()
  const axis = new THREE.Vector3(0, 1, 0)
  const at = new THREE.Vector3()
  const one = new THREE.Vector3(1, 1, 1)
  spots.forEach((spot, index) => {
    mesh.setMatrixAt(index, matrix.compose(at.set(spot.x, 0, spot.z), turn.setFromAxisAngle(axis, spot.rotationY), one))
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

/** One material for post and lantern, told apart by the baked part id. */
function lampMaterial(kit: KitLibrary): THREE.Material {
  const isLens = attribute<'float'>(PART_ATTRIBUTE, 'float').equal(PART.lens)
  const post = rgb(colourOf(kit, LAMP_POST, 0x24352a))
  const lens = rgb(colourOf(kit, LAMP_LENS, 0xffb84a))

  const material = new MeshStandardNodeMaterial()
  material.name = 'kit:streetlight'
  material.colorNode = isLens.select(lens, post)
  material.roughnessNode = isLens.select(float(0.3), float(0.55))
  material.metalnessNode = float(0)
  material.emissiveNode = lens.mul(float(kit.night.level)).mul(isLens.select(float(LENS_GLOW), float(0)))
  return material
}

/**
 * Every halo in the city in one additive quad buffer, billboarded in the vertex
 * shader. One draw whatever the town is, and it goes out with the daylight.
 */
function haloes(spots: readonly LampSpot[], height: number, night: CityNight): THREE.Mesh {
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])

  const at = new Float32Array(spots.length * 3)
  const bounds = new THREE.Box3()
  spots.forEach((spot, index) => {
    at.set([spot.x, height, spot.z], index * 3)
    bounds.expandByPoint(new THREE.Vector3(spot.x, height, spot.z))
  })
  geometry.setAttribute('haloAt', new THREE.InstancedBufferAttribute(at, 3))
  geometry.instanceCount = spots.length
  geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere())
  geometry.boundingSphere.radius += HALO.radius

  const mesh = new THREE.Mesh(geometry, haloMaterial(night))
  mesh.name = 'kit:streetlights:halo'
  mesh.renderOrder = 1
  mesh.raycast = () => {}
  return mesh
}

/** The glow itself. */
function haloMaterial(night: CityNight): THREE.Material {
  // the soft edge of the glow, and the daylight switch: both a single number
  const falloff = smoothstep(0.5, 0, uv().sub(vec2(0.5, 0.5)).length())

  const material = new SpriteNodeMaterial()
  material.name = 'kit:streetlight-halo'
  material.positionNode = attribute<'vec3'>('haloAt', 'vec3')
  material.scaleNode = vec2(HALO.radius, HALO.radius)
  material.colorNode = rgb(new THREE.Color(HALO.colour))
  material.opacityNode = falloff.mul(falloff).mul(falloff).mul(float(night.level))
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  material.transparent = true
  return material
}

/** The colour the pack painted a part, or a sane one if the pack has no opinion. */
function colourOf(kit: KitLibrary, name: string, fallback: number): THREE.Color {
  const material = kit.material(name)
  return material instanceof THREE.MeshStandardMaterial ? material.color : new THREE.Color(fallback)
}

/** A colour as a node. Its channels are already in the working space. */
function rgb(colour: THREE.Color): Vec3Node {
  return vec3(colour.r, colour.g, colour.b)
}
