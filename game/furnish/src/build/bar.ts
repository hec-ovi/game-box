import * as THREE from 'three'
import type { Look } from './look.ts'
import { everyCorner } from './outline.ts'
import type { Solid } from './solid.ts'

/**
 * The one primitive laid on its side: the same extrusion, running along X or Z
 * instead of up.
 *
 * A handle over a toolbox, the shaft of a wrench, a dial on the front of a
 * radio and a strap over a bag are all bars, and every one of them is a
 * `Solid.block` inside a turned frame. Nothing here makes geometry of its own.
 */
export interface Bar {
  /** Which way the bar runs. */
  readonly axis: 'x' | 'z'
  readonly x?: number
  readonly y: number
  readonly z?: number
  /** Metres along the axis it runs. */
  readonly length: number
  /** Metres tall. */
  readonly thick: number
  /** Metres across the run, level. Defaults to `thick`, which makes it round. */
  readonly deep?: number
  readonly corner?: number
  readonly arc?: number
  readonly look: Look
}

export function bar(solid: Solid, spec: Bar): void {
  const across = spec.deep ?? spec.thick
  const turn =
    spec.axis === 'x'
      ? new THREE.Matrix4().makeRotationZ(-Math.PI / 2)
      : new THREE.Matrix4().makeRotationX(Math.PI / 2)
  const plan = spec.axis === 'x' ? { width: spec.thick, depth: across } : { width: across, depth: spec.thick }
  const frame = new THREE.Matrix4().makeTranslation(spec.x ?? 0, spec.y, spec.z ?? 0).multiply(turn)

  solid.in(frame, () => {
    solid.block({
      ...plan,
      y0: -spec.length / 2,
      y1: spec.length / 2,
      corner: everyCorner(spec.corner ?? Math.min(spec.thick, across) / 2),
      arc: spec.arc ?? 2,
      look: spec.look,
    })
  })
}

/** Two uprights and a rail over them: the handle on a case, a can or a bag. */
export function handle(
  solid: Solid,
  spec: { axis: 'x' | 'z'; span: number; y0: number; y1: number; thick: number; offset?: number; look: Look },
): void {
  const half = spec.span / 2 - spec.thick / 2
  for (const side of [-1, 1]) {
    const post = side * half
    solid.block({
      x: spec.axis === 'x' ? post : (spec.offset ?? 0),
      z: spec.axis === 'x' ? (spec.offset ?? 0) : post,
      width: spec.thick,
      depth: spec.thick,
      y0: spec.y0,
      y1: spec.y1 - spec.thick / 2,
      corner: everyCorner(spec.thick / 2),
      arc: 2,
      look: spec.look,
    })
  }
  bar(solid, {
    axis: spec.axis,
    ...(spec.axis === 'x' ? { z: spec.offset ?? 0 } : { x: spec.offset ?? 0 }),
    y: spec.y1 - spec.thick / 2,
    length: spec.span,
    thick: spec.thick,
    look: spec.look,
  })
}
