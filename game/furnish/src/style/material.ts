import { Fn, If, attribute, vec3 } from 'three/tsl'
import { MeshStandardNodeMaterial, type Node } from 'three/webgpu'
import { pictureNode } from '../screens/glass.ts'

/**
 * The one material every piece of furniture in the game draws with.
 *
 * Colour, emission and finish are vertex attributes rather than uniforms, so a
 * teal desk panel, a pale worktop and a lit strip live on one buffer and a
 * whole room is one material. That is the same shape `@gb/scene` used to take
 * the city from 1,069 draws to 46, and it is what lets an interior batch.
 *
 * A screen is the same material too. A fifth attribute says where on the glass
 * a vertex is, which station is on it and how far into that station's schedule
 * it is; everything that is not a screen carries zeroes there and takes the
 * emission its look asked for. The picture runs inside a branch, so the rest of
 * the room pays for the screen only in four bytes a vertex.
 *
 * The nodes are TSL because the game draws with `WebGPURenderer`, which runs no
 * `onBeforeCompile` on either backend.
 */
export const SOLID_MATERIAL = 'furnish:solid'

/** The attribute that says a face is glass. Normalized bytes: u, v, station, phase. */
export const SCREEN_ATTRIBUTE = 'screen'

export function solidMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ name: SOLID_MATERIAL })
  material.colorNode = attribute('shade', 'vec3')
  material.emissiveNode = emission()
  material.roughnessNode = attribute('rough', 'float')
  material.metalnessNode = attribute('metal', 'float')
  return material
}

/** What a face gives off: the flat glow it was painted with, or what is on it. */
function emission() {
  return Fn(() => {
    const screen = attribute(SCREEN_ATTRIBUTE, 'vec4') as unknown as Node<'vec4'>
    const station = screen.z.mul(255).round()
    const out = vec3(attribute('glow', 'vec3') as unknown as Node<'vec3'>).toVar()
    If(station.greaterThan(0.5), () => {
      out.assign(pictureNode(screen.xy, station, screen.w))
    })
    return out
  })()
}
