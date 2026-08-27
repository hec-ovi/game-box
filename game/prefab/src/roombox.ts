import type * as THREE from 'three'
import { abs, cameraPosition, clamp, float, int, max, min, mix, normalWorld, normalize, positionWorld, select, step, texture, vec2, vec3 } from 'three/tsl'
import type { Node } from 'three/webgpu'
import type { BayLayout } from './bays.ts'
import { ROOM_SIZE, type Faces } from './rooms.ts'
import type { SurfaceFrame } from './surface.ts'

/**
 * The room behind a window, marched in the fragment shader.
 *
 * The view ray is intersected with an axis aligned box behind the opening and
 * the picture is read on whichever face it meets first. The room slides in the
 * frame as you walk past, the side walls close in at an angle, and none of it
 * costs a triangle: what a fragment needs is where it sits in the picture,
 * which the uv already says, and how many metres wide a bay is, which the
 * surface's own derivatives already say.
 *
 * Each face reads its own layer of the strip. The back wall is the room, drawn
 * per kind of place; the floor, the ceiling and the two side walls are the four
 * shared faces every room in the pack uses, and they are flat elevations rather
 * than the back wall folded round its own edges, so a side wall is a side wall
 * and not a column of the room stretched over three metres. It is still one
 * fetch, because the layer is an index rather than another picture to work out
 * the region of.
 */

/** How dark the room is where it meets the glass against how bright at the back of it. */
const NEAR_DARK = 0.25

/** How dark the floor, the ceiling and the side walls are against the back wall. They are out of the light. */
const SIDE_DARK = 0.45

/**
 * What the ray met, and the light coming off it.
 *
 * `light` is the picture at that point, unlit and untinted: what the room is
 * worth before the night decides whether anyone is home.
 */
export function roomBox(
  strip: THREE.DataArrayTexture,
  faces: Faces,
  bay: BayLayout,
  frame: SurfaceFrame,
  wall: Node<'int'>,
  flip: Node<'float'>,
  swap: Node<'float'>,
): Node<'vec3'> {
  // the box is all in the bay's own frame, so batching a building into a
  // shared buffer moves the vertices and leaves the room where it was
  const face = normalize(normalWorld)
  const view = normalize(positionWorld.sub(cameraPosition))
  const ray = vec3(view.dot(frame.along.normalize()), view.dot(frame.down.normalize()), max(view.dot(face).negate(), 1e-3))
  const from = vec3(bay.at.x.mul(bay.wide), bay.at.y.mul(bay.tall), 0)
  const toSide = reach(from.x, bay.wide, ray.x)
  const toDeck = reach(from.y, bay.tall, ray.y)
  const toBack = bay.deep.div(ray.z)
  const met = from.add(ray.mul(min(min(toSide, toDeck), toBack)))
  const sideways = clamp(met.x.div(bay.wide), 0, 1)
  // v runs down the wall on every picture in the pack, so this runs down the
  // room too and a face's own picture lands the way up it was drawn
  const downward = clamp(met.y.div(bay.tall), 0, 1)
  const behind = clamp(met.z.div(bay.deep), 0, 1)

  const onBack = toBack.lessThanEqual(toSide).and(toBack.lessThanEqual(toDeck))
  const onSide = toSide.lessThan(toBack).and(toSide.lessThanEqual(toDeck))

  // depth runs into the room whichever face is read from, so a side wall's own
  // picture is not mirrored between the left and the right of one room
  const inward = select(ray.x.greaterThanEqual(0), behind, float(1).sub(behind))
  const backward = select(ray.y.greaterThanEqual(0), behind, float(1).sub(behind))

  // which side wall this is, and which of the two pictures it wears: the sign
  // of the ray says left or right, and one bit of the room's own seed says
  // which way round the pair sits, so opposite walls always differ
  const rightWall = step(0, ray.x)
  const alt = abs(rightWall.sub(swap))
  const side = select(alt.greaterThan(0.5), int(faces.sideAlt), int(faces.side))
  const deck = select(ray.y.greaterThanEqual(0), int(faces.floor), int(faces.ceiling))
  const layer = select(onBack, wall, select(onSide, side, deck))

  const u = select(onBack, sideways, select(onSide, inward, sideways))
  const v = select(onBack, downward, select(onSide, downward, backward))

  // one fetch, at the level the wall itself is being read at. The hit point
  // jumps where the ray changes face, and a mip chosen off that would band
  // along every one of those lines
  const seen = texture(strip, vec2(mix(u, float(1).sub(u), flip), v))
    .depth(layer)
    .level(max(max(bay.aa.x, bay.aa.y).mul(ROOM_SIZE).log2(), 0)).rgb

  return seen.mul(mix(float(NEAR_DARK), float(1), behind)).mul(select(onBack, float(1), float(SIDE_DARK)))
}

/** How far the ray runs before it leaves the box on this axis. */
function reach(from: Node<'float'>, size: Node<'float'>, ray: Node<'float'>): Node<'float'> {
  return select(ray.greaterThanEqual(0), size.sub(from), from).div(max(abs(ray), 1e-4))
}
