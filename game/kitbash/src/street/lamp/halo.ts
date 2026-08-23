import * as THREE from 'three'
import { attribute, float, mix, smoothstep, uv, vec2 } from 'three/tsl'
import { SpriteNodeMaterial } from 'three/webgpu'
import type { CityNight } from '../../night/night.ts'
import { rgb } from '../../night/nodes.ts'
import { HALO, LOOK } from './design.ts'
import { GLOW_AT } from './model.ts'
import type { Lamp } from './variants.ts'

/** Per lamp: where its glow sits, how big it is, and how cool. */
const ATTRIBUTES = { at: 'haloAt', size: 'haloSize', tint: 'haloTint' } as const

/**
 * The wet air round every lit head in the city, in one additive quad buffer:
 * one draw whatever the size of the town, and it goes out with the daylight.
 * Two triangles a lamp is not worth a draw of its own to cull, so unlike the
 * posts these are not cut into districts.
 *
 * It is sized to the thing that is lit rather than to the lamp: a small disc
 * under a head, a tall sliver beside a strip. It is the scatter, not the glow.
 * The glow is the app's bloom pass reading a panel authored just under clipping.
 */
export function buildHaloes(lamps: readonly Lamp[], night: CityNight): THREE.Mesh {
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])

  const at = new Float32Array(lamps.length * 3)
  const size = new Float32Array(lamps.length * 2)
  const tint = new Float32Array(lamps.length)
  const bounds = new THREE.Box3()
  let widest = 0
  lamps.forEach((lamp, index) => {
    const on = lamp.overhead ? GLOW_AT.head : GLOW_AT.strip
    const turn = Math.sin(lamp.rotationY) * on[2] * lamp.scale
    const forward = Math.cos(lamp.rotationY) * on[2] * lamp.scale
    const point = new THREE.Vector3(lamp.x + turn, on[1] * lamp.scale, lamp.z + forward)
    at.set(point.toArray(), index * 3)
    const spread = lamp.overhead ? HALO.head : HALO.strip
    size.set([spread[0] * lamp.scale, spread[1] * lamp.scale], index * 2)
    tint[index] = lamp.tint
    bounds.expandByPoint(point)
    widest = Math.max(widest, spread[0], spread[1])
  })
  geometry.setAttribute(ATTRIBUTES.at, new THREE.InstancedBufferAttribute(at, 3))
  geometry.setAttribute(ATTRIBUTES.size, new THREE.InstancedBufferAttribute(size, 2))
  geometry.setAttribute(ATTRIBUTES.tint, new THREE.InstancedBufferAttribute(tint, 1))
  geometry.instanceCount = lamps.length
  geometry.boundingSphere = bounds.getBoundingSphere(new THREE.Sphere())
  geometry.boundingSphere.radius += widest

  const mesh = new THREE.Mesh(geometry, haloMaterial(night))
  mesh.name = 'kit:streetlights:halo'
  mesh.renderOrder = 1
  mesh.raycast = () => {}
  return mesh
}

/** The scatter itself: soft to the edge, out by day. */
function haloMaterial(night: CityNight): THREE.Material {
  const falloff = smoothstep(0.5, 0, uv().sub(vec2(0.5, 0.5)).length())

  const material = new SpriteNodeMaterial()
  material.name = 'kit:streetlight-halo'
  material.positionNode = attribute<'vec3'>(ATTRIBUTES.at, 'vec3')
  material.scaleNode = attribute<'vec2'>(ATTRIBUTES.size, 'vec2')
  material.colorNode = mix(rgb(LOOK.warm), rgb(LOOK.cool), attribute<'float'>(ATTRIBUTES.tint, 'float'))
  material.opacityNode = falloff.mul(falloff).mul(falloff).mul(float(night.level)).mul(HALO.strength)
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  material.transparent = true
  return material
}
