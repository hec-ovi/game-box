/**
 * The things made of paper and board: an envelope, a card, a book, a ledger, a
 * bundle of cash, a framed picture.
 *
 * All of them are flat, and what tells them apart is size and what is printed
 * on them, so the shapes are thin slabs and the detail is a raised patch of a
 * different matter, standing `PRINT` off a face set back by the same amount.
 */
import type { Solid } from '../build/solid.ts'
import { everyCorner } from '../build/outline.ts'
import { cornersOf, edgeOf, heft } from '../style/variant.ts'
import { BURY, PRINT, type ItemBuilder } from './builder.ts'
import type { ItemCast } from './cast.ts'

export const envelope: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const face = height - PRINT
  const sheet = heft(cast, face * 0.6, face * 0.82)
  solid.block({
    width,
    depth,
    y0: 0,
    y1: sheet,
    corner: everyCorner(0.003),
    arc: 1,
    top: edgeOf(cast, 0.0008),
    look: cast.body,
  })
  // the flap, folded shut over the back half
  solid.block({
    z: -depth * 0.22,
    width: width - 0.008,
    depth: depth * 0.5,
    y0: sheet - BURY,
    y1: face,
    corner: everyCorner(0.003),
    arc: 1,
    look: cast.body,
  })
  // the stamp in the corner, and two lines of address across the middle
  solid.block({
    x: width * 0.36,
    z: -depth * 0.26,
    width: 0.03,
    depth: 0.024,
    y0: face - BURY,
    y1: height,
    look: cast.mark,
  })
  for (const [back, run] of [
    [0.058, 0.09],
    [0.082, 0.065],
  ] as const) {
    solid.block({
      x: -width * 0.1,
      z: depth * 0.5 - back,
      width: run,
      depth: 0.005,
      y0: face - BURY,
      y1: height - PRINT * 0.4,
      look: cast.trim,
    })
  }
}

/**
 * A deed: a sheet with a title across its head, lines of terms down it, and a
 * seal in the corner where it was signed. The seal is the one mark, the thing
 * that says whose the place is now.
 */
export const deed: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const face = height - PRINT
  const seal = 0.028
  solid.block({
    width,
    depth,
    y0: 0,
    y1: face,
    corner: everyCorner(0.002),
    arc: 1,
    top: edgeOf(cast, 0.0008),
    look: cast.body,
  })
  solid.block({
    z: -depth * 0.38,
    width: width * 0.6,
    depth: 0.012,
    y0: face - BURY,
    y1: height,
    look: cast.trim,
  })
  for (let line = 0; line < 6; line++) {
    solid.block({
      x: -width * 0.05,
      z: -depth * 0.2 + line * 0.024,
      width: width * heft(cast, 0.62, 0.76) - (line === 5 ? 0.06 : 0),
      depth: 0.005,
      y0: face - BURY,
      y1: height - PRINT * 0.4,
      look: cast.trim,
    })
  }
  solid.block({
    x: width * 0.3,
    z: depth * 0.36,
    width: seal,
    depth: seal,
    y0: face - BURY,
    y1: height,
    corner: everyCorner(seal / 2),
    arc: 3,
    look: cast.mark,
  })
}

export const keycard: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const face = height - PRINT
  solid.block({ width, depth, y0: 0, y1: face, corner: everyCorner(0.0035), arc: 2, look: cast.body })
  // the chip, the band a reader takes, and a printed panel
  solid.block({
    x: -width * 0.28,
    z: -depth * 0.14,
    width: 0.013,
    depth: 0.011,
    y0: face - BURY,
    y1: height,
    look: cast.mark,
  })
  solid.block({
    z: depth * 0.3,
    width: width - 0.008,
    depth: 0.008,
    y0: face - BURY,
    y1: height,
    look: cast.trim,
  })
  solid.block({
    x: width * 0.24,
    z: -depth * 0.2,
    width: 0.02,
    depth: 0.014,
    y0: face - BURY,
    y1: height - PRINT * 0.4,
    look: cast.lit ? cast.mark : cast.trim,
  })
}

/** A hardback lying shut, spine to the left. */
export const book: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  bound(solid, cast, width, depth, height)
}

/** The same construction, half again as big, with a label and a strap. */
export const ledger: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const spine = bound(solid, cast, width, depth, height)
  solid.block({
    x: spine * 0.5,
    z: -depth * 0.2,
    width: width * 0.45,
    depth: depth * 0.24,
    y0: height - PRINT - BURY,
    y1: height,
    look: cast.mark,
  })
  // the strap over the fore-edge, proud of the cover and inside the box
  solid.block({
    x: width * 0.5 - 0.026,
    width: 0.012,
    depth,
    y0: 0.0004,
    y1: height,
    corner: everyCorner(0.004),
    arc: 1,
    look: cast.trim,
  })
}

/**
 * Two boards, a block of pages between them and a spine down the left in the
 * cast's fittings, which is what makes a shut book read as a book from above.
 * Returns how wide the spine came out, so a label can be centred on the cover.
 */
function bound(solid: Solid, cast: ItemCast, width: number, depth: number, height: number): number {
  const spine = Math.max(0.014, height * 0.4)
  const board = Math.min(0.008, height * 0.18)
  const cover = height - PRINT
  for (const y0 of [0, cover - board]) {
    solid.block({
      x: spine * 0.5,
      width: width - spine,
      depth,
      y0,
      y1: y0 + board,
      corner: cornersOf(cast, 0.004),
      arc: 1,
      look: cast.body,
    })
  }
  solid.block({
    x: spine * 0.5 + 0.002,
    width: width - spine - 0.008,
    depth: depth - 0.006,
    y0: board,
    y1: cover - board,
    look: cast.mark,
  })
  solid.block({
    x: -(width - spine) * 0.5,
    width: spine,
    depth,
    y0: 0,
    y1: cover,
    corner: [0, spine * 0.5, spine * 0.5, 0],
    arc: 2,
    look: cast.trim,
  })
  return spine
}

/** A brick of notes under two bands, with the print showing on the top one. */
export const cash: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const notes = 7
  const stack = height - 0.001
  const sheet = stack / notes
  for (let at = 0; at < notes; at++) {
    // each leaf sits a hair inside the one under it, so the brick reads as notes
    const shrink = 0.0015 * Math.abs(at - (notes - 1) / 2)
    solid.block({
      width: width - 0.002 - shrink,
      depth: depth - 0.002 - shrink,
      y0: at * sheet,
      y1: (at + 1) * sheet - 0.0002,
      corner: everyCorner(0.002),
      arc: 1,
      look: cast.body,
    })
  }
  solid.block({
    width: width * 0.34,
    depth: depth * 0.44,
    y0: stack - PRINT,
    y1: stack,
    corner: everyCorner(0.002),
    arc: 1,
    look: cast.mark,
  })
  for (const x of [-width * 0.24, width * 0.24]) {
    solid.block({
      x,
      width: 0.016,
      depth,
      y0: 0.0004,
      y1: height,
      corner: everyCorner(0.002),
      arc: 1,
      look: cast.trim,
    })
  }
}

/** A framed picture standing on its bottom rail. */
export const painting: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const rail = heft(cast, 0.028, 0.045)
  const canvas = depth * 0.4
  for (const y0 of [0, height - rail]) {
    solid.block({ width, depth, y0, y1: y0 + rail, corner: cornersOf(cast, 0.006), look: cast.trim })
  }
  for (const x of [-(width - rail) / 2, (width - rail) / 2]) {
    solid.block({
      x,
      width: rail,
      depth,
      y0: rail,
      y1: height - rail,
      corner: cornersOf(cast, 0.006),
      look: cast.trim,
    })
  }
  solid.block({
    width: width - 2 * rail + 0.004,
    depth: canvas,
    y0: rail - 0.002,
    y1: height - rail + 0.002,
    look: cast.body,
  })
  // two shapes on the canvas: enough to read as a picture rather than a blank
  solid.block({
    x: -width * 0.12,
    width: (width - 2 * rail) * 0.42,
    depth: canvas + 0.002,
    y0: height * 0.3,
    y1: height * 0.66,
    look: cast.mark,
  })
  solid.block({
    x: width * 0.16,
    width: (width - 2 * rail) * 0.24,
    depth: canvas + 0.004,
    y0: height * 0.22,
    y1: height * 0.48,
    look: cast.lit ? cast.trim : cast.body,
  })
}
