import * as THREE from 'three'
import { everyCorner } from '../build/outline.ts'
import { strip, support } from '../build/parts.ts'
import { cornersOf, edgeOf, heft } from '../style/variant.ts'
import type { Build, PropBuilder } from './builder.ts'

/**
 * Everything one body sits on: the seat pad's top face is drawn at the seat
 * height and the rest of the chair hangs off it, so the backrest can be any
 * shape at all without moving where the hips land.
 */

/** How far a backrest leans off vertical. */
const LEAN = (6 * Math.PI) / 180

export const chair: PropBuilder = (build) => {
  const { solid, variant, width, depth, contact } = build
  const pad = heft(variant, 0.05, 0.09)
  const seatWidth = width - 0.04
  const seatDepth = depth - 0.06

  support(solid, variant, { width, depth, top: contact - pad, inset: 0.03 })
  pillow(build, { width: seatWidth, depth: seatDepth, y0: contact - pad, y1: contact })
  back(build, { width: seatWidth, at: depth / 2 - 0.075, y0: contact - 0.02, rise: 0.44 })
  if (variant.trim) {
    strip(solid, variant, { z: -depth / 2 + 0.01, width: seatWidth - 0.1, depth: 0.02, y: contact - pad - 0.02 })
  }
}

export const officeChair: PropBuilder = (build) => {
  const { solid, variant, width, depth, contact } = build
  const pad = 0.08
  const hub = 0.09
  const column = 0.06

  // five arms on castors, then the gas column: the shape of the base is what says office
  for (let arm = 0; arm < 5; arm++) {
    solid.in(new THREE.Matrix4().makeRotationY((arm * 2 * Math.PI) / 5), () => {
      solid.block({
        z: -(width / 2 - 0.06) / 2,
        width: 0.05,
        depth: width / 2 - 0.06,
        y0: 0.035,
        y1: 0.07,
        corner: everyCorner(0.02),
        arc: 2,
        look: variant.palette.frame,
      })
      solid.block({
        z: -(width / 2 - 0.08),
        width: 0.05,
        depth: 0.05,
        y0: 0,
        y1: 0.05,
        corner: everyCorner(0.025),
        arc: 3,
        look: variant.palette.frame,
      })
    })
  }
  solid.block({
    width: hub,
    depth: hub,
    y0: 0.05,
    y1: 0.12,
    corner: everyCorner(hub / 2),
    look: variant.palette.frame,
  })
  solid.block({
    width: column,
    depth: column,
    y0: 0.12,
    y1: contact - pad,
    corner: everyCorner(column / 2),
    look: variant.palette.frame,
  })

  pillow(build, { width: width - 0.08, depth: depth - 0.1, y0: contact - pad, y1: contact })
  back(build, { width: width - 0.14, at: depth / 2 - 0.09, y0: contact - 0.01, rise: 0.5 })
  for (const side of [-1, 1]) {
    const x = (side * (width - 0.05)) / 2
    solid.block({
      x,
      z: depth / 2 - 0.14,
      width: 0.04,
      depth: 0.04,
      y0: contact,
      y1: contact + 0.2,
      corner: everyCorner(0.015),
      arc: 2,
      look: variant.palette.frame,
    })
    solid.block({
      x,
      z: -0.02,
      width: 0.05,
      depth: depth - 0.22,
      y0: contact + 0.16,
      y1: contact + 0.2,
      corner: everyCorner(0.02),
      arc: 2,
      look: variant.palette.frame,
    })
  }
  if (variant.trim) {
    strip(solid, variant, { z: -depth / 2 + 0.06, width: width - 0.18, depth: 0.02, y: contact - pad - 0.02 })
  }
}

export const barStool: PropBuilder = (build) => {
  const { solid, variant, width, contact } = build
  const pad = 0.05
  const base = width * 0.72
  const column = 0.055

  solid.block({
    width: base,
    depth: base,
    y0: 0,
    y1: 0.022,
    corner: everyCorner(base / 2),
    arc: 5,
    topInset: 0.035,
    look: variant.palette.frame,
  })
  solid.block({
    width: column,
    depth: column,
    y0: 0.02,
    y1: contact - pad,
    corner: everyCorner(column / 2),
    arc: 4,
    look: variant.palette.frame,
  })
  // the footrest: a body on a stool at bar height needs somewhere to put its feet
  solid.block({
    width: width * 0.62,
    depth: width * 0.62,
    y0: contact * 0.26,
    y1: contact * 0.26 + 0.02,
    corner: everyCorner((width * 0.62) / 2),
    arc: 5,
    look: variant.palette.frame,
  })
  pillow(build, { width: width - 0.04, depth: width - 0.04, y0: contact - pad, y1: contact, round: true })
  if (variant.trim) {
    strip(solid, variant, { z: -width / 2 + 0.009, width: width - 0.14, depth: 0.018, y: contact - pad - 0.018 })
  }
}

/** A seat pad or a mattress: a soft slab whose top face is the contact surface. */
export function pillow(
  build: Build,
  spec: { width: number; depth: number; y0: number; y1: number; round?: boolean },
): void {
  const { solid, variant } = build
  solid.block({
    width: spec.width,
    depth: spec.depth,
    y0: spec.y0,
    y1: spec.y1,
    corner: spec.round ? everyCorner(spec.width / 2) : cornersOf(variant, spec.width / 3),
    arc: spec.round ? 6 : 4,
    top: edgeOf(variant, Math.min(0.018, (spec.y1 - spec.y0) * 0.4)),
    bottom: { kind: 'chamfer', size: 0.01 },
    look: variant.palette.soft,
  })
}

/** A backrest leaning off the seat, hinged so its top stays inside the footprint. */
function back(build: Build, spec: { width: number; at: number; y0: number; rise: number }): void {
  const { solid, variant } = build
  solid.in(new THREE.Matrix4().makeTranslation(0, spec.y0, spec.at).multiply(new THREE.Matrix4().makeRotationX(LEAN)), () => {
    solid.block({
      width: spec.width,
      depth: 0.05,
      y0: 0,
      y1: spec.rise,
      corner: cornersOf(variant, spec.width / 4),
      top: edgeOf(variant, 0.024),
      look: variant.palette.soft,
    })
  })
}
