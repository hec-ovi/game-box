import { everyCorner } from '../build/outline.ts'
import { doors, strip } from '../build/parts.ts'
import { cornersOf, edgeOf, heft } from '../style/variant.ts'
import type { Build, PropBuilder } from './builder.ts'

/**
 * Everything that stands against a wall and holds things: open shelving, a
 * cupboard, a wardrobe, a fridge, a lit display case, a stack of stock.
 *
 * They share one carcass, so the language reads the same across a room: gables
 * and a back, then either shelves with a strip under each one or leaves across
 * the front. The declared height is drawn, not scaled to.
 */

const LEAF = 0.03
const PROUD = 0.006

export const shelf: PropBuilder = (build) => open(build, { lit: build.variant.trim, shelves: build.variant.divisions + 2 })

/** An open chilled cabinet: lit whatever the variant says, because the light is the point. */
export const displayCase: PropBuilder = (build) => open(build, { lit: true, shelves: 3, glow: true })

export const cabinet: PropBuilder = (build) => closed(build, { count: 2, toe: 0.06 })

export const wardrobe: PropBuilder = (build) => closed(build, { count: 2, toe: 0.05 })

export const fridge: PropBuilder = (build) => {
  const { solid, variant, width, depth, height } = build
  closed(build, { count: 1, toe: 0.05, split: 0.62 })
  // a cool line down the door split is what tells a fridge from a cupboard
  solid.block({
    z: -depth / 2 + 0.004,
    width: width - 0.1,
    depth: 0.008,
    y0: height * 0.615,
    y1: height * 0.625,
    corner: everyCorner(0.004),
    arc: 2,
    look: variant.palette.screen,
  })
  solid.block({
    z: -depth / 2 + 0.004,
    width: width - 0.14,
    depth: 0.008,
    y0: 0.02,
    y1: 0.045,
    corner: everyCorner(0.004),
    arc: 2,
    look: variant.palette.frame,
  })
}

export const crateStack: PropBuilder = (build) => {
  const { solid, variant, width, depth, height } = build
  const layers = 3
  const tall = height / layers
  const box = { w: (width - 0.02) / 2, d: (depth - 0.02) / 2 }

  for (let layer = 0; layer < layers; layer++) {
    // the top layer is half stacked, which is what stops a stack reading as one block
    const cells: readonly (readonly [number, number])[] =
      layer === layers - 1 ? [[-1, -1], [1, 1]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]]
    for (const [x, z] of cells) {
      solid.block({
        x: (x * (width - box.w)) / 2,
        z: (z * (depth - box.d)) / 2,
        width: box.w - 0.008,
        depth: box.d - 0.008,
        y0: layer * tall,
        y1: (layer + 1) * tall,
        corner: cornersOf(variant, box.w / 4),
        top: edgeOf(variant, 0.012),
        bottom: edgeOf(variant, 0.012),
        look: layer % 2 === 0 ? variant.palette.shell : variant.palette.frame,
      })
      if (variant.trim && z < 0) {
        strip(solid, variant, {
          x: (x * (width - box.w)) / 2,
          z: (z * (depth - box.d)) / 2 - box.d / 2 + 0.008,
          width: box.w - 0.06,
          depth: 0.012,
          y: layer * tall + tall * 0.55,
          thickness: 0.01,
        })
      }
    }
  }
}

/** Gables, a back and shelves, with a line of light under each shelf. */
function open(build: Build, spec: { lit: boolean; shelves: number; glow?: boolean }): void {
  const { solid, variant, width, depth, height } = build
  const side = heft(variant, 0.025, 0.04)
  const board = 0.022
  const shelves = spec.shelves

  for (const way of [-1, 1]) {
    solid.block({
      x: (way * (width - side)) / 2,
      width: side,
      depth,
      y0: 0,
      y1: height,
      corner: cornersOf(variant, side / 2),
      look: variant.palette.shell,
    })
  }
  solid.block({
    z: depth / 2 - 0.008,
    width: width - 2 * side,
    depth: 0.016,
    y0: 0,
    y1: height,
    look: spec.glow ? variant.palette.screen : variant.palette.accent,
  })
  for (let at = 0; at <= shelves; at++) {
    const y = board + ((height - board) * at) / shelves
    solid.block({
      width: width - 2 * side,
      depth,
      y0: y - board,
      y1: y,
      corner: cornersOf(variant, board),
      top: edgeOf(variant, 0.008),
      look: variant.palette.top,
    })
    if (spec.lit && at > 0) {
      strip(solid, variant, {
        z: -depth / 2 + 0.02,
        width: width - 2 * side - 0.04,
        depth: 0.014,
        y: y - board - 0.014,
        thickness: 0.012,
      })
    }
  }
}

/** A carcass with leaves across the front and a recessed toe under it. */
function closed(build: Build, spec: { count: number; toe: number; split?: number }): void {
  const { solid, variant, width, depth, height } = build

  solid.block({
    width: width - 0.06,
    depth: depth - 0.05,
    y0: 0,
    y1: spec.toe,
    look: variant.palette.frame,
  })
  solid.block({
    z: LEAF / 2,
    width,
    depth: depth - LEAF,
    y0: spec.toe,
    y1: height,
    corner: cornersOf(variant),
    top: edgeOf(variant, 0.015),
    look: variant.palette.shell,
  })

  const split = spec.split === undefined ? undefined : spec.toe + (height - spec.toe) * spec.split
  const bands: [number, number][] =
    split === undefined ? [[spec.toe, height]] : [[spec.toe, split], [split, height]]
  for (const [y0, y1] of bands) {
    doors(solid, variant, {
      width: width - 0.02,
      front: -depth / 2 + PROUD,
      thickness: LEAF - PROUD,
      y0,
      y1,
      count: spec.count,
    })
  }
  if (variant.trim) {
    strip(solid, variant, {
      z: -depth / 2 + 0.006,
      width: width - 0.08,
      depth: 0.012,
      y: spec.toe - 0.022,
      thickness: 0.012,
    })
  }
}
