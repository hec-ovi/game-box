import * as THREE from 'three'
import { normalMap, texture, vec3 } from 'three/tsl'
import type { Node, NormalMapNode } from 'three/webgpu'

/**
 * What a wall is, past the colour it is painted: how it is shaped and how rough
 * it is.
 *
 * One opaque layer per finish, in the same order and at the same size as the
 * colour strip, read at the same uv, so a joint in the picture is a joint in
 * the relief. Two channels carry the normal and the third is recovered from
 * them, because a height field never faces away from its own surface; the third
 * channel carries roughness. One image and one fetch rather than two of each,
 * which on a strip of 23 layers is 8 MB and a sampler saved.
 *
 * The roughness is absolute, not a modifier: what a layer's texel says is what
 * the material is, worked out offline per family in
 * `tools/textures/relief/surfaces.mjs`. So the glazed tile ships at 0.18 with
 * grout at 0.86 and the precast concrete at 0.74 to 0.96, where the whole city
 * used to be 0.68.
 */
export class WallRelief {
  readonly #strip: THREE.DataArrayTexture

  constructor(strip: THREE.DataArrayTexture) {
    this.#strip = strip
  }

  /** Both of them at one point of one layer, off one fetch. */
  read(at: Node<'vec2'>, layer: Node<'int'>): WallSurface {
    const packed = texture(this.#strip, at).depth(layer)
    const flat = packed.rg.mul(2).sub(1)
    // the third axis of a unit normal off a height field is always positive
    const stand = flat.dot(flat).oneMinus().max(0).sqrt()

    return {
      // back into the 0 to 1 the node unpacks from, so three's own tangent
      // frame and flat-shading handling are the ones doing the work
      normal: normalMap(vec3(flat, stand).mul(0.5).add(0.5)),
      roughness: packed.b,
    }
  }
}

export interface WallSurface {
  /** A view space normal, ready for `material.normalNode`. */
  readonly normal: NormalMapNode
  readonly roughness: Node<'float'>
}
