import { FixtureShape } from '../shape.ts'
import { CAMERA } from './design.ts'

const { bracket, body, hood, pitch, material } = CAMERA

/** One camera in its own frame: the bracket out of the wall, the housing on it looking out and down, the hood on its front. */
export function cameraShape(): FixtureShape {
  const shape = new FixtureShape('camera')
  const tilt: readonly [number, number, number] = [pitch, 0, 0]
  const at = bracket.out + body[2] / 2 - 0.04
  shape.slab(material, [bracket.thick, bracket.thick, bracket.out], [0, 0, bracket.out / 2])
  shape.slab(material, body, [0, -0.02, at], tilt)
  // the hood sits on the front of the housing, along the way it looks
  const reach = at + body[2] / 2 + hood[2] / 2
  shape.slab(material, hood, [0, -0.02 - Math.sin(pitch) * (reach - at), Math.cos(pitch) * (reach - at) + at], tilt)
  return shape
}
