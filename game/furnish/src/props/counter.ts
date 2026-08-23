import { everyCorner } from '../build/outline.ts'
import { doors, recess, strip } from '../build/parts.ts'
import { cornersOf, edgeOf, heft } from '../style/variant.ts'
import type { Build, PropBuilder } from './builder.ts'

/**
 * The run you are served over and the run food is made on: a carcass with a
 * slab on top, and the slab's top face is the contact height.
 *
 * The bar counter is the only piece in the catalog worked from both sides, so
 * it is the only one with two of them. The customer's drink stands on the
 * raised rail at bar height; the bartender's forearms rest on the shelf behind
 * it at service-counter height, which is where `@gb/cast`'s lean clip puts a
 * body's hands. One piece, two heights, both drawn rather than assumed.
 */

/** The slice of depth at the front a door or a panel fills. */
const LEAF = 0.03
/** The slice in front of that, kept for lit trim so nothing is ever coplanar. */
const PROUD = 0.006

export const counter: PropBuilder = (build) => {
  const { solid, variant, width, depth, contact } = build
  const slab = heft(variant, 0.03, 0.05)

  carcass(build, contact - slab)
  face(build, 0.06, contact - slab)
  top(build, { width, depth, y0: contact - slab, y1: contact })
  if (variant.trim) {
    strip(solid, variant, { z: -depth / 2 + 0.006, width: width - 0.1, depth: 0.012, y: contact - slab - 0.05 })
  }
}

export const barCounter: PropBuilder = (build) => {
  const { solid, variant, width, depth, contact, staff } = build
  const slab = heft(variant, 0.035, 0.055)
  const shelf = depth * 0.4
  const rail = depth - shelf

  carcass(build, staff - slab)
  face(build, 0.06, staff - slab)
  solid.block({
    z: (depth - shelf) / 2,
    width,
    depth: shelf,
    y0: staff - slab,
    y1: staff,
    corner: cornersOf(variant, shelf / 3),
    top: edgeOf(variant, Math.min(0.018, slab * 0.5)),
    look: variant.palette.top,
  })
  solid.block({
    z: -(depth - rail) / 2 + PROUD / 2,
    width,
    depth: rail - PROUD,
    y0: staff - slab,
    y1: contact - slab,
    corner: cornersOf(variant, rail / 4),
    look: variant.palette.shell,
  })
  top(build, { width, depth: rail, z: -(depth - rail) / 2, y0: contact - slab, y1: contact })

  // a rail to put a boot on, inside the footprint so it cannot trip anyone
  solid.block({
    z: -depth / 2 + 0.04,
    width: width - 0.1,
    depth: 0.035,
    y0: 0.18,
    y1: 0.215,
    corner: everyCorner(0.017),
    arc: 3,
    look: variant.palette.frame,
  })
  if (variant.trim) {
    strip(solid, variant, { z: -depth / 2 + 0.006, width: width - 0.08, depth: 0.012, y: contact - slab - 0.055 })
  }
}

export const stove: PropBuilder = (build) => {
  const { solid, variant, width, depth, contact } = build
  const slab = 0.03

  carcass(build, contact - slab)
  doors(solid, variant, {
    width: width - 0.03,
    front: -depth / 2 + PROUD,
    thickness: LEAF - PROUD,
    y0: 0.1,
    y1: contact - slab - 0.06,
    count: 1,
  })
  // the oven window: the one lit thing on a kitchen run
  solid.block({
    z: -depth / 2 + 0.005,
    width: width - 0.16,
    depth: 0.01,
    y0: 0.22,
    y1: contact - slab - 0.22,
    corner: everyCorner(0.005),
    arc: 2,
    look: variant.palette.screen,
  })
  top(build, { width, depth, y0: contact - slab, y1: contact })

  const ring = Math.min(width, depth) * 0.3
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      solid.block({
        x: (x * (width - ring)) / 2 - x * 0.045,
        z: (z * (depth - ring)) / 2 - z * 0.045,
        width: ring,
        depth: ring,
        y0: contact - 0.014,
        y1: contact - 0.005,
        corner: everyCorner(ring / 2),
        arc: 5,
        look: variant.palette.frame,
      })
    }
  }
}

export const sink: PropBuilder = (build) => {
  const { solid, variant, width, depth, contact } = build
  const bowl = 0.18

  carcass(build, contact - bowl)
  doors(solid, variant, {
    width: width - 0.03,
    front: -depth / 2 + PROUD,
    thickness: LEAF - PROUD,
    y0: 0.1,
    y1: contact - bowl - 0.02,
    count: 2,
  })
  recess(solid, variant, {
    width,
    depth,
    hole: width * 0.6,
    holeDepth: depth * 0.55,
    top: contact,
    deep: bowl,
    look: variant.palette.top,
    floor: variant.palette.frame,
  })
  // a tap, standing behind the bowl and well inside the footprint
  solid.block({
    z: depth / 2 - 0.06,
    width: 0.035,
    depth: 0.035,
    y0: contact,
    y1: contact + 0.24,
    corner: everyCorner(0.017),
    arc: 4,
    look: variant.palette.frame,
  })
  solid.block({
    z: depth / 2 - 0.14,
    width: 0.03,
    depth: 0.16,
    y0: contact + 0.22,
    y1: contact + 0.25,
    corner: everyCorner(0.015),
    arc: 3,
    look: variant.palette.frame,
  })
}

/** The body of a run: a plinth and a box on it, drawn short of the front so a panel can fill it. */
function carcass(build: Build, top: number): void {
  const { solid, variant, width, depth } = build
  const toe = 0.06
  solid.block({ width: width - 0.08, depth: depth - 0.06, y0: 0, y1: toe, look: variant.palette.frame })
  solid.block({
    z: LEAF / 2,
    width,
    depth: depth - LEAF,
    y0: toe,
    y1: top,
    corner: cornersOf(variant),
    openTop: true,
    look: variant.palette.shell,
  })
}

/** The slab, with its top face drawn at the height a body meets it. */
function top(build: Build, spec: { width: number; depth: number; z?: number; y0: number; y1: number }): void {
  const { solid, variant } = build
  solid.block({
    ...(spec.z === undefined ? {} : { z: spec.z }),
    width: spec.width,
    depth: spec.depth,
    y0: spec.y0,
    y1: spec.y1,
    corner: cornersOf(variant, spec.depth / 4),
    top: edgeOf(variant, Math.min(0.018, (spec.y1 - spec.y0) * 0.5)),
    bottom: edgeOf(variant, Math.min(0.01, (spec.y1 - spec.y0) * 0.25)),
    look: variant.palette.top,
  })
}

/** The public side of a counter: one accent panel, which is all a customer sees. */
function face(build: Build, y0: number, y1: number): void {
  const { solid, variant, width, depth } = build
  solid.block({
    z: -depth / 2 + PROUD + (LEAF - PROUD) / 2,
    width: width - 0.06,
    depth: LEAF - PROUD,
    y0,
    y1,
    corner: cornersOf(variant, LEAF),
    look: variant.palette.accent,
  })
}
