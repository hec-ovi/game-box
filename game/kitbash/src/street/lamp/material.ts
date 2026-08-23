import type * as THREE from 'three'
import { attribute, exp2, float, fract, mix, positionLocal } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import type { CityNight } from '../../night/night.ts'
import { rgb } from '../../night/nodes.ts'
import { LAMP_ATTRIBUTES, LOOK, PART } from './design.ts'

/**
 * One material for the whole lamp: the mast, the lit panel and the camera's
 * status light, told apart by the surface baked on each vertex.
 *
 * It also decides what a lamp is made of. Every lamp in the city is one buffer
 * carrying every fitting, and the vertices of a fitting this lamp does not have
 * are collapsed onto its own base, so they rasterise nothing. That is what buys
 * a street of lamps that differ from one another at one draw a district.
 *
 * Nothing here glows in daylight and nothing here draws its own halo. A panel
 * is authored just under clipping and the app's bloom pass makes the light,
 * exactly the way the signage is authored: a lamp on a wet road is two bright
 * things, itself and its reflection, and geometry glow doubles both.
 */
export function lampMaterial(night: CityNight): THREE.Material {
  const part = attribute<'float'>(LAMP_ATTRIBUTES.part, 'float')
  const group = attribute<'float'>(LAMP_ATTRIBUTES.group, 'float')
  const variant = attribute<'vec2'>(LAMP_ATTRIBUTES.variant, 'vec2')
  const base = attribute<'vec3'>(LAMP_ATTRIBUTES.base, 'vec3')

  // group 0 is on every lamp; the rest answer to a bit of the lamp's own kit
  const fitted = group.equal(0).or(fract(variant.x.div(exp2(group))).greaterThanEqual(0.5))
  const isLens = part.equal(PART.lens)
  const isMark = part.equal(PART.mark)
  const lens = mix(rgb(LOOK.warm), rgb(LOOK.cool), variant.y)
  const mark = rgb(LOOK.mark)

  const material = new MeshStandardNodeMaterial()
  material.name = 'kit:streetlight'
  material.positionNode = fitted.select(positionLocal, base)
  material.colorNode = isLens.select(lens, isMark.select(mark, rgb(LOOK.post)))
  material.roughnessNode = isLens.select(float(LOOK.lensRoughness), float(LOOK.postRoughness))
  // the panel burns, the status light burns, and the mast catches a little spill
  const burn = isLens.select(lens.mul(LOOK.glow), isMark.select(mark.mul(LOOK.markGlow), rgb(LOOK.spill).mul(LOOK.spillStrength)))
  material.emissiveNode = burn.mul(float(night.level))
  material.metalnessNode = float(0)
  return material
}
