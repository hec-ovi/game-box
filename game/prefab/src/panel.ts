import type * as THREE from 'three'
import { float, max, mix, texture, vec2 } from 'three/tsl'
import type { Node } from 'three/webgpu'
import type { BayLayout } from './bays.ts'
import { ROOM_SIZE } from './rooms.ts'

/**
 * A window with nothing behind it: a closed curtain, a lowered blind, frosted
 * glass, a bricked up opening, a blank lit panel.
 *
 * Most windows in a street are one of these. There is no room to look into, so
 * there is no box to march and no view ray to intersect: the picture is read
 * flat across the opening, one fetch and no arithmetic beyond the uv the bay
 * already gives. It is the cheap kind, and it is what makes the rare marched
 * room worth stopping at.
 */

/** What a flat panel is worth against a room with its lights on. It is a surface catching light, not a lit space. */
export const PANEL = { dim: 0.78 } as const

/** The picture on the panel behind this fragment, unlit and untinted. */
export function flatPanel(strip: THREE.DataArrayTexture, bay: BayLayout, picture: Node<'int'>, flip: Node<'float'>): Node<'vec3'> {
  // the picture fills the opening, read on the same two axes the room box
  // measures its faces on, and at the same level: a bay's uv jumps at every
  // bay edge, and a mip chosen off that would band along all of them
  const u = mix(bay.at.x, float(1).sub(bay.at.x), flip)
  return texture(strip, vec2(u, bay.at.y))
    .depth(picture)
    .level(max(max(bay.aa.x, bay.aa.y).mul(ROOM_SIZE).log2(), 0))
    .rgb.mul(float(PANEL.dim))
}
