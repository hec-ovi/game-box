import { dFdx, dFdy, fwidth, max, min, positionWorld, select, uv } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * How much wall a unit of uv covers here, read off the surface itself.
 *
 * A prefab wall is a flat quad with a picture stretched over it and nothing on
 * the vertices says how big the picture is in metres. The surface's own
 * derivatives do: the change in world position against the change in uv is the
 * two in-plane vectors one unit of the picture spans. Reading it rather than
 * assuming it is what lets one bay be the size it really is however the
 * producer laid the picture on that wall, and what makes a mirrored building
 * come out right.
 *
 * It has to be read outside any branch. A derivative taken inside flow that
 * some fragments of a quad do not enter is not defined, and a quad straddling
 * two layers is exactly that case.
 */
export interface SurfaceFrame {
  /** The world vector one unit of u spans, and one unit of v. */
  readonly along: Node<'vec3'>
  readonly down: Node<'vec3'>
  /** Metres across one unit of u, and down one unit of v. */
  readonly wide: Node<'float'>
  readonly tall: Node<'float'>
  /** How much uv one pixel covers, which is what every edge on the surface is feathered by. */
  readonly spread: Node<'vec2'>
}

export function surfaceFrame(): SurfaceFrame {
  const dpx = dFdx(positionWorld)
  const dpy = dFdy(positionWorld)
  const duvx = dFdx(uv())
  const duvy = dFdy(uv())

  const det = duvx.x.mul(duvy.y).sub(duvx.y.mul(duvy.x))
  const safe = select(det.greaterThanEqual(0), max(det, 1e-12), min(det, -1e-12))
  const along = dpx.mul(duvy.y).sub(dpy.mul(duvx.y)).div(safe)
  const down = dpy.mul(duvx.x).sub(dpx.mul(duvy.x)).div(safe)

  return { along, down, wide: along.length(), tall: down.length(), spread: fwidth(uv()) }
}
