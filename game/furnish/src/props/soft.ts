import * as THREE from 'three'
import { everyCorner } from '../build/outline.ts'
import { strip } from '../build/parts.ts'
import { cornersOf, edgeOf, heft } from '../style/variant.ts'
import { pillow } from './seat.ts'
import type { PropBuilder } from './builder.ts'

/**
 * The two pieces a body lies or sprawls on. Both are a shell with a cushion in
 * it, and the cushion's top face is the contact surface: a mattress at exactly
 * the mattress height, a sofa seat at exactly the seat height.
 *
 * Both carry a cove under the base, which is the light the home reference does
 * most of its work with.
 */

const at = (x: number, z: number): THREE.Matrix4 => new THREE.Matrix4().makeTranslation(x, 0, z)

export const sofa: PropBuilder = (build) => {
  const { solid, variant, width, depth, contact } = build
  const arm = heft(variant, 0.14, 0.2)
  const pad = 0.14
  const base = contact - pad
  const backDepth = 0.16
  const inner = width - 2 * arm

  solid.block({
    width: width - 0.24,
    depth: depth - 0.2,
    y0: 0,
    y1: 0.03,
    openTop: true,
    look: variant.palette.frame,
  })
  solid.block({
    width: width - 0.08,
    depth: depth - 0.08,
    y0: 0.03,
    y1: base,
    corner: cornersOf(variant),
    openTop: true,
    look: variant.palette.shell,
  })
  for (const side of [-1, 1]) {
    solid.block({
      x: (side * (width - arm)) / 2,
      width: arm,
      depth,
      y0: 0.03,
      y1: contact + 0.17,
      corner: cornersOf(variant, arm / 2),
      top: edgeOf(variant, Math.min(0.05, arm / 3)),
      look: variant.palette.soft,
    })
  }
  solid.block({
    z: (depth - backDepth) / 2,
    width: inner,
    depth: backDepth,
    y0: base,
    y1: contact + 0.35,
    corner: cornersOf(variant, backDepth / 2),
    top: edgeOf(variant, 0.05),
    look: variant.palette.soft,
  })

  const span = inner / variant.divisions
  for (let seat = 0; seat < variant.divisions; seat++) {
    solid.in(at(-inner / 2 + span / 2 + seat * span, -backDepth / 2), () => {
      pillow(build, { width: span - 0.02, depth: depth - backDepth - 0.06, y0: base, y1: contact })
    })
  }
  if (variant.trim) strip(solid, variant, { z: -depth / 2 + 0.01, width: width - 0.3, depth: 0.02, y: 0.008 })
}

export const bed: PropBuilder = (build) => {
  const { solid, variant, width, depth, contact } = build
  const base = contact - 0.2
  const head = 0.1
  const lying = depth - head

  solid.block({
    width: width - 0.06,
    depth: depth - 0.06,
    y0: 0.035,
    y1: base,
    corner: cornersOf(variant),
    openTop: true,
    look: variant.palette.shell,
  })
  solid.block({
    z: (depth - head) / 2,
    width,
    depth: head,
    y0: 0,
    y1: contact + 0.5,
    corner: cornersOf(variant, head / 2),
    top: edgeOf(variant, 0.04),
    look: variant.palette.shell,
  })
  solid.in(at(0, -head / 2), () => {
    pillow(build, { width: width - 0.04, depth: lying - 0.03, y0: base, y1: contact })
  })

  // a pillow at the head and a cover folded over the foot: what says bed at a glance
  solid.in(at(0, depth / 2 - head - 0.19), () => {
    solid.block({
      width: width * 0.62,
      depth: 0.3,
      y0: contact,
      y1: contact + 0.07,
      corner: everyCorner(0.05),
      top: { kind: 'round', size: 0.035 },
      look: variant.palette.top,
    })
  })
  solid.in(at(0, -depth / 2 + 0.28), () => {
    solid.block({
      width: width - 0.03,
      depth: 0.5,
      y0: contact,
      y1: contact + 0.025,
      corner: cornersOf(variant),
      top: edgeOf(variant, 0.012),
      look: variant.palette.accent,
    })
  })
  if (variant.trim) strip(solid, variant, { z: -depth / 2 + 0.01, width: width - 0.24, depth: 0.02, y: 0.01 })
}
