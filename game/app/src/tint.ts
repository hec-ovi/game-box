import { luminance, mix, vec3, vec4 } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * What the dark end of the frame is multiplied by. Green and blue held, red
 * pulled down: a neutral grey shadow comes out teal without getting any
 * brighter, which is the colour the air is in every one of the references.
 */
const COLD = vec3(0.62, 0.97, 1.06)

/**
 * The luminance the tint has faded out by. Anything under this is air, wall and
 * road, and takes the colour of the night; anything over it is a sign, a lamp
 * or a lit window, and keeps the colour it was authored.
 */
const SHADOW_TOP = 0.55

/**
 * The night colour grade: cold shadows, saturated lights.
 *
 * Neon does not read against a neutral frame. What makes a sign look like a
 * sign is that everything not lit by one is a different, colder colour, so the
 * grade takes the dark end towards teal and leaves anything bright alone, then
 * puts back the saturation the tone map takes off on the way to the screen.
 *
 * @param colour the frame so far, in linear light
 * @param cold 0 leaves the shadows where they are, 1 takes them all the way
 * @param saturation 1 is untouched, over 1 pushes colour away from grey
 */
export function graded(colour: Node<'vec4'>, cold: Node<'float'>, saturation: Node<'float'>): Node<'vec4'> {
  const rgb = colour.rgb
  const dark = luminance(rgb).div(SHADOW_TOP).oneMinus().clamp(0, 1).mul(cold)
  const cooled = rgb.mul(mix(vec3(1, 1, 1), COLD, dark))
  return vec4(mix(vec3(luminance(cooled)), cooled, saturation), colour.a)
}
