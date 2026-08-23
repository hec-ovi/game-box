import { strip, support } from '../build/parts.ts'
import { cornersOf, edgeOf, heft } from '../style/variant.ts'
import type { Build, PropBuilder } from './builder.ts'

/**
 * A slab on something, with its top at exactly the table height.
 *
 * The table and the desk are the same piece with different furniture on the
 * underside: the desk gets a modesty panel across the back and a pedestal under
 * one end, which is what a corpo desk row is made of.
 */

export const table: PropBuilder = (build) => slab(build, {})

export const desk: PropBuilder = (build) => slab(build, { back: true, pedestal: true })

function slab(build: Build, extras: { back?: boolean; pedestal?: boolean }): void {
  const { solid, variant, width, depth, contact } = build
  const thick = heft(variant, 0.03, 0.06)
  const under = contact - thick

  support(solid, variant, { width, depth, top: under })

  if (extras.pedestal) {
    const box = Math.min(0.42, width / 3)
    solid.block({
      x: -(width - box) / 2 + 0.05,
      width: box,
      depth: depth - 0.12,
      y0: 0.02,
      y1: under - 0.02,
      corner: cornersOf(variant),
      look: variant.palette.accent,
    })
  }

  if (extras.back) {
    solid.block({
      z: depth / 2 - 0.03,
      width: width - 0.16,
      depth: 0.02,
      y0: under - 0.32,
      y1: under - 0.02,
      look: variant.palette.shell,
    })
  }

  solid.block({
    width,
    depth,
    y0: under,
    y1: contact,
    corner: cornersOf(variant),
    top: edgeOf(variant, Math.min(0.02, thick * 0.6)),
    bottom: edgeOf(variant, Math.min(0.012, thick * 0.3)),
    look: variant.palette.top,
  })

  if (variant.trim) {
    strip(solid, variant, {
      z: -depth / 2 + 0.05,
      width: width - 0.16,
      depth: 0.02,
      y: under - 0.02,
    })
  }
}
