import * as THREE from 'three'
import { everyCorner } from '../build/outline.ts'
import { RED_LAMP } from '../style/lit.ts'
import { cornersOf } from '../style/variant.ts'
import type { PropBuilder } from './builder.ts'

/**
 * A security camera: a plate on the wall, an arm off it, and a housing pitched
 * down at the room with a lens at its end and a red diode over it.
 *
 * It hangs at its `lift`, back to the wall, front looking into the room, and
 * claims no floor. The plate's top is the declared height exactly and the
 * lowest point of the housing is the base, so the whole thing sits inside the
 * cells `@gb/world` gives it however far it is pitched.
 */

/** Radians the housing looks down. */
const PITCH = (25 * Math.PI) / 180
const HOUSING = { length: 0.15, radius: 0.034 }
/** Where the housing pivots: the arm's end, in the prop's frame. */
const PIVOT_Z = 0.062

export const camera: PropBuilder = (build) => {
  const { solid, variant, width, height } = build
  const { palette } = variant
  // the lowest point of a pitched cylinder is its far rim: put it on the floor of the box
  const drop = HOUSING.length * Math.sin(PITCH) + HOUSING.radius * Math.cos(PITCH)
  const plateTop = height
  const plateBottom = plateTop - 0.16

  solid.block({
    z: 0.09,
    width: width - 0.02,
    depth: 0.02,
    y0: plateBottom,
    y1: plateTop,
    corner: cornersOf(variant, 0.012),
    look: palette.shell,
  })
  solid.block({
    z: (0.08 + PIVOT_Z) / 2,
    width: 0.03,
    depth: 0.08 - PIVOT_Z + 0.02,
    y0: drop - 0.015,
    y1: drop + 0.015,
    corner: everyCorner(0.01),
    arc: 2,
    look: palette.frame,
  })

  const pitched = new THREE.Matrix4()
    .makeTranslation(0, drop, PIVOT_Z)
    .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2 - PITCH))
  solid.in(pitched, () => {
    solid.block({
      width: HOUSING.radius * 2,
      depth: HOUSING.radius * 2,
      y0: 0,
      y1: HOUSING.length,
      corner: everyCorner(HOUSING.radius),
      arc: 4,
      look: palette.shell,
    })
    // the lens: a darker ring standing off the end
    solid.block({
      width: HOUSING.radius * 1.4,
      depth: HOUSING.radius * 1.4,
      y0: HOUSING.length,
      y1: HOUSING.length + 0.006,
      corner: everyCorner(HOUSING.radius * 0.7),
      arc: 4,
      look: palette.frame,
    })
    // the diode over the lens, red so it reads as recording
    solid.block({
      z: -HOUSING.radius,
      width: 0.008,
      depth: 0.006,
      y0: HOUSING.length - 0.03,
      y1: HOUSING.length - 0.022,
      corner: everyCorner(0.003),
      arc: 2,
      look: RED_LAMP,
    })
  })
}

