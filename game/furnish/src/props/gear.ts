import * as THREE from 'three'
import { everyCorner } from '../build/outline.ts'
import { strip } from '../build/parts.ts'
import { SCREEN_MARK } from '../screens/screening.ts'
import { cornersOf, edgeOf } from '../style/variant.ts'
import type { PropBuilder } from './builder.ts'

/**
 * The lit things: a till, a coffee machine, a screen, a light column and the
 * speakers a bar plays through.
 *
 * These are where most of a room's emission comes from, so every one of them
 * carries a face in the palette's screen or glow look. With the app's bloom on,
 * that face is the lamp; there is no light object anywhere in this box.
 */

export const register: PropBuilder = (build) => {
  const { solid, variant, width, depth, height } = build

  solid.block({
    width,
    depth,
    y0: 0,
    y1: height * 0.4,
    corner: cornersOf(variant, width / 4),
    top: edgeOf(variant, 0.01),
    look: variant.palette.shell,
  })
  solid.block({
    z: depth * 0.14,
    width: width * 0.8,
    depth: depth * 0.5,
    y0: height * 0.4,
    y1: height,
    corner: cornersOf(variant, width / 5),
    top: edgeOf(variant, 0.012),
    look: variant.palette.shell,
  })
  // the display, leaning back at the angle a clerk reads it from
  solid.in(
    new THREE.Matrix4()
      .makeTranslation(0, height * 0.42, -depth * 0.1)
      .multiply(new THREE.Matrix4().makeRotationX(-(18 * Math.PI) / 180)),
    () => {
      solid.block({
        width: width * 0.7,
        depth: 0.012,
        y0: 0,
        y1: height * 0.5,
        corner: everyCorner(0.01),
        arc: 2,
        look: variant.palette.screen,
      })
    },
  )
  solid.block({
    z: -depth / 2 + 0.006,
    width: width * 0.6,
    depth: 0.012,
    y0: height * 0.12,
    y1: height * 0.18,
    corner: everyCorner(0.006),
    arc: 2,
    look: variant.palette.frame,
  })
}

export const coffeeMachine: PropBuilder = (build) => {
  const { solid, variant, width, depth, height } = build
  const nook = height * 0.34

  solid.block({
    z: depth * 0.16,
    width,
    depth: depth * 0.68,
    y0: 0,
    y1: height,
    corner: cornersOf(variant, width / 5),
    top: edgeOf(variant, 0.015),
    look: variant.palette.shell,
  })
  // the drip tray and the lit hollow the cup stands in
  solid.block({
    z: -depth * 0.16,
    width: width * 0.86,
    depth: depth * 0.36,
    y0: 0,
    y1: 0.02,
    corner: cornersOf(variant, 0.015),
    look: variant.palette.frame,
  })
  solid.block({
    z: -depth * 0.16,
    width: width * 0.86,
    depth: depth * 0.36,
    y0: nook,
    y1: height,
    corner: cornersOf(variant, 0.02),
    look: variant.palette.shell,
  })
  strip(solid, variant, { z: -depth * 0.16, width: width * 0.7, depth: 0.016, y: nook - 0.014 })
  for (const side of [-1, 1]) {
    solid.block({
      x: side * width * 0.16,
      z: -depth * 0.06,
      width: 0.02,
      depth: 0.02,
      y0: nook - 0.05,
      y1: nook,
      corner: everyCorner(0.01),
      arc: 3,
      look: variant.palette.frame,
    })
  }
  solid.block({
    z: -depth * 0.34 - 0.006,
    width: width * 0.5,
    depth: 0.014,
    y0: height * 0.78,
    y1: height * 0.9,
    corner: everyCorner(0.007),
    arc: 2,
    look: variant.palette.screen,
  })
}

export const tv: PropBuilder = (build) => {
  const { solid, variant, width, depth, height } = build
  const panel = 0.035
  const foot = 0.12

  solid.block({
    width: width * 0.4,
    depth,
    y0: 0,
    y1: 0.018,
    corner: cornersOf(variant, 0.02),
    top: edgeOf(variant, 0.008),
    look: variant.palette.frame,
  })
  solid.block({
    z: depth * 0.33,
    width: 0.06,
    depth: 0.05,
    y0: 0.018,
    y1: foot,
    corner: everyCorner(0.015),
    look: variant.palette.frame,
  })
  solid.block({
    z: depth / 2 - panel / 2,
    width,
    depth: panel,
    y0: foot,
    y1: height,
    corner: cornersOf(variant, 0.02),
    top: edgeOf(variant, 0.01),
    look: variant.palette.shell,
  })
  // the picture: the whole face, so it is the light in the room and not a decal,
  // and marked as glass so what is playing runs across it rather than one colour
  solid.block({
    z: depth / 2 - panel - 0.005,
    width: width - 0.03,
    depth: 0.01,
    y0: foot + 0.015,
    y1: height - 0.015,
    corner: everyCorner(0.008),
    arc: 2,
    look: variant.palette.screen,
    screen: SCREEN_MARK,
  })
}

export const lamp: PropBuilder = (build) => {
  const { solid, variant, width, height } = build
  const base = width - 0.04
  const column = width * 0.4

  solid.block({
    width: base,
    depth: base,
    y0: 0,
    y1: 0.02,
    corner: cornersOf(variant, base / 2),
    arc: 5,
    topInset: 0.02,
    look: variant.palette.frame,
  })
  solid.block({
    width: column,
    depth: column,
    y0: 0.018,
    y1: height,
    corner: cornersOf(variant, column / 2),
    arc: 5,
    top: edgeOf(variant, 0.012),
    look: variant.palette.shell,
  })
  // a lit seam up the column rather than a shade: light is architecture here
  for (const side of [-1, 1]) {
    solid.block({
      x: (side * column) / 2,
      width: 0.012,
      depth: column * 0.5,
      y0: 0.12,
      y1: height - 0.06,
      corner: everyCorner(0.006),
      arc: 2,
      look: variant.palette.glow,
    })
  }
}

export const jukebox: PropBuilder = (build) => {
  const { solid, variant, width, depth, height } = build
  const column = (width - 0.06) / 2

  for (const side of [-1, 1]) {
    const x = (side * (width - column)) / 2
    solid.block({
      x,
      z: 0.004,
      width: column,
      depth: depth - 0.008,
      y0: 0,
      y1: height,
      corner: cornersOf(variant, column / 4),
      top: edgeOf(variant, 0.02),
      bottom: edgeOf(variant, 0.012),
      look: variant.palette.shell,
    })
    // three cones behind a grille, then the band that says it is playing
    for (const cone of [0.24, 0.52, 0.76]) {
      const size = column * (cone < 0.5 ? 0.62 : 0.4)
      solid.block({
        x,
        z: -depth / 2 + 0.008,
        width: size,
        depth: 0.016,
        y0: height * cone - size / 2,
        y1: height * cone + size / 2,
        corner: everyCorner(size / 2),
        arc: 5,
        look: variant.palette.frame,
      })
    }
    strip(solid, variant, {
      x,
      z: -depth / 2 + 0.006,
      width: column - 0.05,
      depth: 0.012,
      y: height * 0.9,
    })
  }
}
