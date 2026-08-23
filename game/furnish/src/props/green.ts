import * as THREE from 'three'
import { everyCorner } from '../build/outline.ts'
import { cornersOf, edgeOf } from '../style/variant.ts'
import type { PropBuilder } from './builder.ts'

/**
 * The two soft things. Both languages want a plant: it is the one thing in the
 * references that is not moulded, machined or lit, and a room reads as lived in
 * because of it.
 *
 * A rug is 2 cm thick, which is under the height `@gb/scene` treats as a
 * blocker, so it never stops anybody walking over it.
 */

/** How far a leaf leans off vertical, at most. Any further and it leaves the footprint. */
const LEAN = (20 * Math.PI) / 180

export const plant: PropBuilder = (build) => {
  const { solid, variant, width, depth } = build
  const pot = Math.min(width, depth) * 0.62
  const rim = 0.3
  const soil = rim - 0.02

  solid.block({
    width: pot,
    depth: pot,
    y0: 0,
    y1: rim,
    corner: everyCorner(pot / 2),
    arc: 5,
    bottomInset: pot * 0.16,
    top: edgeOf(variant, 0.012),
    look: variant.palette.pot,
  })
  solid.block({
    width: pot * 0.82,
    depth: pot * 0.82,
    y0: soil - 0.02,
    y1: soil,
    corner: everyCorner((pot * 0.82) / 2),
    arc: 5,
    look: variant.palette.frame,
  })

  // eight, so four of them lean straight along the axes and the plant fills its
  // cells evenly; every leaf reaches the same distance out, so it stays centred
  const blades = 8
  const reach = Math.min(width, depth) / 2 - 0.03
  for (let blade = 0; blade < blades; blade++) {
    const turn = (blade * 2 * Math.PI) / blades
    const lean = blade % 2 === 0 ? LEAN : LEAN * 0.78
    const long = reach / Math.sin(lean)
    solid.in(
      new THREE.Matrix4()
        .makeTranslation(0, soil - 0.01, 0)
        .multiply(new THREE.Matrix4().makeRotationY(turn))
        .multiply(new THREE.Matrix4().makeRotationX(lean)),
      () => {
        solid.block({
          width: 0.055,
          depth: 0.012,
          y0: 0,
          y1: long,
          corner: everyCorner(0.006),
          arc: 2,
          topInset: 0.02,
          look: variant.palette.foliage,
        })
      },
    )
  }
}

export const rug: PropBuilder = (build) => {
  const { solid, variant, width, depth, height } = build
  solid.block({
    width,
    depth,
    y0: 0,
    y1: height * 0.7,
    corner: cornersOf(variant, 0.12),
    look: variant.palette.accent,
  })
  solid.block({
    width: width - 0.16,
    depth: depth - 0.16,
    y0: height * 0.6,
    y1: height,
    corner: cornersOf(variant, 0.1),
    top: edgeOf(variant, 0.006),
    look: variant.palette.soft,
  })
}
