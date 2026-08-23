/**
 * Interior mapping: a furnished room drawn behind every window pane in the
 * fragment shader. No geometry, no texture, no extra draw.
 *
 * The pane carries the room it looks into (see room.ts). The view ray is cast
 * into that box in the pane's own frame and whatever it meets first, the shell
 * or a piece of furniture, is shaded from the room's two look numbers. That is
 * what stops a facade reading as a decal: you see a floor, a back wall and
 * depth through the glass.
 *
 * The technique, and most of the shape of this file, is three's own
 * examples/jsm/generators/city/SkyscraperGenerator.js (MIT).
 */
import {
  attribute, cameraPosition, color, cross, dot, float, fract, mix, modelWorldMatrixInverse,
  normalLocal, positionLocal, select, smoothstep, step, vec2, vec3, vec4,
} from 'three/tsl'
import type { BoolNode, FloatNode, Vec3Node } from './nodes.ts'
import { ROOM_ATTRIBUTES } from './room.ts'

/** What a pane shows, and how much of it the pane gives off on its own. */
export interface RoomShading {
  readonly colour: Vec3Node
  /** 1 while the room's lights are on, 0 while they are off. */
  readonly lit: FloatNode
}

/** The room starts just behind the pane, so it sits flush in the frame opening. */
const SETBACK = 0.06

/** How deep a room runs, as a share of its height. */
const DEPTH = 1.55

/**
 * The room behind the pane this fragment is on. `litShare` is the share of the
 * city's rooms with the lights on: a room is lit while its own key is under it,
 * so the same rooms light up in the same order every night and none of them
 * flickers.
 */
export function roomBehindGlass(litShare: FloatNode): RoomShading {
  const centre = attribute<'vec3'>(ROOM_ATTRIBUTES.centre, 'vec3')
  const size = attribute<'vec2'>(ROOM_ATTRIBUTES.size, 'vec2')
  const look = attribute<'vec3'>(ROOM_ATTRIBUTES.look, 'vec3')
  const [key, paint, dressing] = [look.x, look.y, look.z]

  // the pane's own frame, taken from the face it is on: x across the wall, y
  // up, z into the building
  const out = normalLocal
  const across = cross(vec3(0, 1, 0), out).normalize()
  const offset = positionLocal.sub(centre)
  const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
  const ray = positionLocal.sub(eye).normalize()
  const origin = vec3(dot(offset, across), offset.y, 0)
  const direction = vec3(dot(ray, across), ray.y, dot(ray, out).negate())

  // the room box, and the far side of it the ray leaves through: that surface
  // is what you see. Dividing by a direction of nearly zero gives an infinity
  // that min() drops on its own.
  const depth = size.y.mul(DEPTH)
  const high = vec3(size.x.mul(0.5), size.y.mul(0.5), depth.add(SETBACK))
  const low = vec3(high.x.negate(), high.y.negate(), float(SETBACK))
  const leaves = low.sub(origin).div(direction).max(high.sub(origin).div(direction))
  const shellAt = leaves.x.min(leaves.y).min(leaves.z)
  const shellHit = origin.add(direction.mul(shellAt))
  const q = shellHit.sub(low).div(high.sub(low)) // 0..1 inside the room

  const onBack = q.z.greaterThan(0.998)
  const onCeiling = q.y.greaterThan(0.998)
  const onFloor = q.y.lessThan(0.002)

  // darker toward the back of the room, so depth reads even in a bare one
  const fade = (z: FloatNode): FloatNode => mix(1, 0.42, z.sub(SETBACK).div(depth).clamp(0, 1))

  const lit = step(key, litShare)
  // most bulbs run warm; a few rooms run on a cold tube or a television
  const warm = mix(color(0xffb24a), color(0xffe4a4), dressing)
  const cold = mix(color(0xdfe8ff), color(0xa6bcff), paint)
  const bulb = select(fract(dressing.mul(7.31)).greaterThan(0.88), cold, warm)

  // --- the shell: plaster, boards, a ceiling light and a door -------------

  const plaster = mix(mix(color(0x9a8b73), color(0x76808a), paint), color(0xb9ad97), dressing.mul(0.5))
  const walls = mix(plaster, plaster.mul(0.5), smoothstep(0.05, 0.035, q.y)) // skirting board

  const seam = step(0.94, fract(q.x.mul(6)))
  const boards = mix(color(0x4a3320), color(0x6a4c30), paint).mul(seam.mul(0.3).oneMinus())
  const floor = mix(boards, mix(color(0x7a3b32), color(0x39525c), dressing), panel(q.x, q.z, 0.5, 0.6, 0.28, 0.24))

  const shade = smoothstep(0.15, 0.11, vec2(q.x.sub(0.5), q.z.sub(0.45)).length())
  const ceiling = mix(mix(plaster, color(0xffffff), 0.5), bulb.mul(mix(1, 5, lit)), shade)

  const doorAt = mix(0.22, 0.78, paint)
  const door = mix(color(0x5a4631), color(0x39383c), step(0.5, dressing))
  const back = mix(walls, door, panel(q.x, q.y, doorAt, 0.33, 0.085, 0.33))

  const shell = select(onBack, back, select(onCeiling, ceiling, select(onFloor, floor, walls)))
  // soft corner shading, so the box does not read as four flat-lit planes
  const corners = select(onBack, edge(q.x).mul(edge(q.y)),
    select(onFloor.or(onCeiling), edge(q.x).mul(edge(q.z)), edge(q.y).mul(edge(q.z))))

  let colour = shell.mul(mix(0.72, 1, corners)).mul(fade(shellHit.z))

  // --- furniture: solid boxes, nearest one wins ---------------------------

  const nearer = (block: Block, over: Vec3Node): Vec3Node =>
    select(block.hit.and(block.at.lessThan(shellAt)), over.mul(fade(block.point.z)), colour)

  const sofaAt = mix(high.x.mul(-0.3), high.x.mul(0.3), dressing)
  const sofa = boxAt(origin, direction,
    vec3(sofaAt.sub(0.9), low.y, high.z.sub(0.85)),
    vec3(sofaAt.add(0.9), low.y.add(mix(0.75, 0.9, paint)), high.z.sub(0.1)))
  colour = nearer(sofa, mix(color(0x5a4a3a), color(0x42566a), paint).mul(top(sofa, 1.12)))

  const tableAt = mix(-0.5, 0.5, paint)
  const tableZ = float(SETBACK).add(depth.mul(0.5)).add(mix(-0.3, 0.4, dressing))
  const table = boxAt(origin, direction,
    vec3(tableAt.sub(0.55), low.y, tableZ.sub(0.35)),
    vec3(tableAt.add(0.55), low.y.add(0.42), tableZ.add(0.35)))
  colour = nearer(table, mix(color(0x4a3526), color(0x6b4a30), dressing).mul(top(table, 1.25)))

  // a lit room takes on its bulb's colour and reads brighter
  return { colour: colour.mul(mix(vec3(1, 1, 1), bulb, lit.mul(0.85))).mul(mix(1, 1.3, lit)), lit }
}

/** One furniture block: the near face the ray meets, if it meets it at all. */
interface Block {
  readonly at: FloatNode
  readonly point: Vec3Node
  readonly hit: BoolNode
  /** Where on the block the ray landed, 0 to 1 on each axis. */
  readonly local: Vec3Node
}

function boxAt(origin: Vec3Node, direction: Vec3Node, low: Vec3Node, high: Vec3Node): Block {
  const a = low.sub(origin).div(direction)
  const b = high.sub(origin).div(direction)
  const [near, far] = [a.min(b), a.max(b)]
  const at = near.x.max(near.y).max(near.z)
  const point = origin.add(direction.mul(at))
  return {
    at,
    point,
    hit: far.x.min(far.y).min(far.z).greaterThan(at).and(at.greaterThan(0)),
    local: point.sub(low).div(high.sub(low)),
  }
}

/** Brighter on a block's top face, where the light of the room falls on it. */
function top(block: Block, lift: number): FloatNode {
  return select(block.local.y.greaterThan(0.9), float(lift), float(0.84))
}

/** A soft rectangle on a face, given the point and the rectangle in 0..1 coordinates. */
function panel(x: FloatNode, y: FloatNode, cx: FloatNode | number, cy: number, halfWidth: number, halfHeight: number): FloatNode {
  return smoothstep(halfWidth + 0.006, halfWidth - 0.006, x.sub(cx).abs())
    .mul(smoothstep(halfHeight + 0.006, halfHeight - 0.006, y.sub(cy).abs()))
}

/** 0 at a wall, 1 away from it: the fake occlusion in a room's corners. */
function edge(a: FloatNode): FloatNode {
  return smoothstep(0, 0.15, a).mul(smoothstep(0, 0.15, a.oneMinus()))
}
