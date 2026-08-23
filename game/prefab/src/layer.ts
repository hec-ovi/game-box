import { attribute, float } from 'three/tsl'
import type { Node } from 'three/webgpu'
import { LAYER_ATTRIBUTE } from './pack.ts'

/**
 * Which layer of the pack's array textures this fragment's face wears.
 *
 * It is one number for the whole triangle, so interpolation gives it back
 * unchanged; the half step is what keeps a rounding error off the edge.
 */
export function layerIndex(): Node<'int'> {
  return attribute<'float'>(LAYER_ATTRIBUTE, 'float').add(float(0.5)).floor().toInt()
}
