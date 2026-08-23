import type * as THREE from 'three'
import { GROUP, PART, STREETLIGHT } from './design.ts'
import { LampShape, turned, type Point } from './shape.ts'

const { mast, arm, head, strip, camera, box } = STREETLIGHT

/** Where the arm springs off the column, and where it ends over the road. */
const SPRING: Point = [0, mast.height - 0.06, 0]
const TIP: Point = [0, mast.height + arm.rise, arm.reach]

/** The head hangs under the tip and carries on a little past it. */
const HEAD_AT: Point = [0, TIP[1] - head.depth / 2 - 0.01, TIP[2] + head.past]
const LENS_AT = turned(HEAD_AT, [0, -(head.depth + head.lens.depth) / 2 + head.lens.drop, 0], [head.pitch, 0, 0])

/** The strip runs up the road-facing side, flush with the column where it is narrowest. */
const STRIP_AT: Point = [0, (strip.from + strip.to) / 2, radiusAt(strip.to) + strip.depth / 2]

/** The camera looks out along the kerb and down, and its status light looks the same way. */
const BRACKET: Point = [camera.out, camera.at + 0.04, 0]
const CAMERA_LOOK: Point = [Math.cos(camera.pitch), Math.sin(camera.pitch), 0]
const CAMERA_AT = turned(BRACKET, [camera.body[0] / 2, 0, 0], [0, 0, camera.pitch])
const EYE_AT = turned(CAMERA_AT, [camera.body[0] / 2 + 0.004, 0, 0], [0, 0, camera.pitch])

/** Where the light on a lamp actually sits, so the halo can be put on it. */
export const GLOW_AT = { head: LENS_AT, strip: STRIP_AT } as const

/**
 * One street lamp, whole: the column, the arm and head over the road, the lit
 * line up the column for the lamps that have no arm, and the two fittings that
 * hang off the shaft. Every lamp in the city is drawn from this one buffer, and
 * a lamp that does not carry a fitting collapses it in the vertex shader.
 */
export function lampGeometry(): THREE.BufferGeometry {
  const shape = new LampShape()

  // the column: a shoe at the pavement, then a taper up to the springing point
  shape.tube(PART.post, GROUP.always, [0, 0, 0], [0, mast.footHeight, 0], mast.footRadius, mast.baseRadius * 1.15, mast.sides)
  shape.tube(PART.post, GROUP.always, [0, mast.footHeight * 0.7, 0], [0, mast.height, 0], mast.baseRadius, mast.topRadius, mast.sides)

  // the arm out over the road, the flat head on the end of it, and the lit panel under that
  shape.tube(PART.post, GROUP.head, SPRING, TIP, arm.rootRadius, arm.tipRadius, arm.sides, false)
  shape.slab(PART.post, GROUP.head, [head.width, head.depth, head.length], HEAD_AT, [head.pitch, 0, 0])
  shape.slab(PART.lens, GROUP.head, [head.lens.width, head.lens.depth, head.lens.length], LENS_AT, [head.pitch, 0, 0])

  // the other kind: one lit line up the face of the column, and no arm at all
  shape.slab(PART.lens, GROUP.strip, [strip.width, strip.to - strip.from, strip.depth], STRIP_AT)

  // a camera on a stub bracket, with its status light on the front of it
  shape.tube(PART.post, GROUP.camera, [0, camera.at, 0], BRACKET, camera.bracket, camera.bracket, 4, false)
  shape.slab(PART.post, GROUP.camera, camera.body, CAMERA_AT, [0, 0, camera.pitch])
  shape.patch(PART.mark, GROUP.camera, camera.eye, EYE_AT, CAMERA_LOOK)

  // and the service box, on the side away from the road
  shape.slab(PART.post, GROUP.box, box.size, [0, box.at, -(radiusAt(box.at) + box.size[2] / 2 - 0.02)])

  return shape.build()
}

/** How wide the column is at a height, so a fitting sits on it rather than in the air. */
function radiusAt(height: number): number {
  return mast.baseRadius + (mast.topRadius - mast.baseRadius) * Math.min(1, height / mast.height)
}
