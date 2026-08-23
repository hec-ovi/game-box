import { attribute } from 'three/tsl'
import { MeshStandardNodeMaterial } from 'three/webgpu'

/**
 * The one material every piece of furniture in the game draws with.
 *
 * Colour, emission and finish are vertex attributes rather than uniforms, so a
 * teal desk panel, a pale worktop and a lit strip live on one buffer and a
 * whole room is one material. That is the same shape `@gb/scene` used to take
 * the city from 1,069 draws to 46, and it is what lets an interior batch.
 *
 * The nodes are TSL because the game draws with `WebGPURenderer`, which runs no
 * `onBeforeCompile` on either backend.
 */
export const SOLID_MATERIAL = 'furnish:solid'

export function solidMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ name: SOLID_MATERIAL })
  material.colorNode = attribute('shade', 'vec3')
  material.emissiveNode = attribute('glow', 'vec3')
  material.roughnessNode = attribute('rough', 'float')
  material.metalnessNode = attribute('metal', 'float')
  return material
}
