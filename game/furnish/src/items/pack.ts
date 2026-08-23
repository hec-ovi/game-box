/**
 * The things you carry something else in: a crate, a carton, a parcel, a bag, a
 * briefcase, a toolbox, a medical kit, a fuel can.
 *
 * These are the ones most at risk of coming out as the same box, so each is
 * built round the one feature that names it: slats on a crate, a taped seam on
 * a carton, twine on a parcel, loops on a bag, latches on a briefcase, a handle
 * over a toolbox, a cross on a medical kit, a spout on a can.
 */
import { bar, handle } from '../build/bar.ts'
import { everyCorner } from '../build/outline.ts'
import { cornersOf, edgeOf, heft } from '../style/variant.ts'
import { BURY, PROUD, facing, setBack, type ItemBuilder } from './builder.ts'

/** Four posts, three bands of slat a side, a rim over the top. */
export const crate: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const post = 0.03
  const slat = height * 0.19
  const set = 0.003
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      solid.block({
        x: (x * (width - post)) / 2,
        z: (z * (depth - post)) / 2,
        width: post,
        depth: post,
        y0: 0,
        y1: height,
        corner: cornersOf(cast, post / 3),
        arc: 2,
        look: cast.body,
      })
    }
  }
  for (const at of [0.06, 0.4, 0.74]) {
    const y0 = height * at
    for (const z of [-1, 1]) {
      solid.block({
        z: z * (depth / 2 - set - 0.007),
        width: width - post,
        depth: 0.014,
        y0,
        y1: y0 + slat,
        look: cast.body,
      })
    }
    for (const x of [-1, 1]) {
      solid.block({
        x: x * (width / 2 - set - 0.007),
        width: 0.014,
        depth: depth - post,
        y0,
        y1: y0 + slat,
        look: cast.body,
      })
    }
  }
  for (const z of [-1, 1]) {
    solid.block({
      z: z * (depth / 2 - set - 0.008),
      width: width - post,
      depth: 0.016,
      y0: height - 0.03,
      y1: height,
      look: cast.trim,
    })
  }
  // a stencil on one long side, standing off the slat behind it
  solid.block({
    x: -width * 0.18,
    z: -(depth / 2 - (set + PROUD) / 2),
    width: width * 0.26,
    depth: set + PROUD,
    y0: height * 0.42,
    y1: height * 0.42 + slat * 0.62,
    look: cast.mark,
  })
}

/** A carton with its flaps taped shut. */
export const box: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const carton = setBack(depth)
  const lid = 0.004
  solid.block({
    width,
    ...carton,
    y0: 0,
    y1: height - lid,
    corner: cornersOf(cast, 0.01),
    top: edgeOf(cast, 0.004),
    look: cast.body,
  })
  for (const z of [-1, 1]) {
    solid.block({
      z: carton.z + (z * (carton.depth / 2 + 0.002)) / 2,
      width: width - 0.006,
      depth: carton.depth / 2 - 0.004,
      y0: height - lid,
      y1: height - 0.0008,
      look: cast.body,
    })
  }
  bar(solid, {
    axis: 'z',
    z: carton.z,
    y: height - 0.0008,
    length: carton.depth,
    thick: 0.0016,
    deep: 0.05,
    corner: 0.0008,
    look: cast.trim,
  })
  // the label on the long side
  solid.block({
    x: -width * 0.16,
    ...facing(depth),
    width: width * 0.3,
    y0: height * 0.32,
    y1: height * 0.64,
    look: cast.mark,
  })
}

/** Wrapped in paper and tied both ways, with a knot where the runs cross. */
export const parcel: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const twine = 0.006
  const wrap = height - 0.006
  solid.block({
    width: width - 0.0012,
    depth: depth - 0.0012,
    y0: 0,
    y1: wrap,
    corner: everyCorner(heft(cast, 0.006, 0.014)),
    top: { kind: 'round', size: 0.008 },
    look: cast.body,
  })
  solid.block({
    width: twine,
    depth,
    y0: 0.0004,
    y1: height - 0.003,
    corner: everyCorner(twine / 2),
    arc: 1,
    look: cast.trim,
  })
  solid.block({
    width,
    depth: twine,
    y0: 0.0004,
    y1: height - 0.003,
    corner: everyCorner(twine / 2),
    arc: 1,
    look: cast.trim,
  })
  solid.block({
    x: -width * 0.26,
    z: -depth * 0.24,
    width: 0.036,
    depth: 0.028,
    y0: wrap - BURY,
    y1: wrap + 0.0008,
    look: cast.mark,
  })
  solid.block({
    width: 0.02,
    depth: 0.02,
    y0: height - 0.005,
    y1: height,
    corner: everyCorner(0.01),
    arc: 2,
    look: cast.trim,
  })
}

/** A soft holdall: rounded everywhere, with two carrying loops over the top. */
export const bag: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const body = height * 0.72
  const shell = width - 2 * PROUD
  solid.block({
    width: shell,
    depth,
    y0: 0,
    y1: body,
    corner: everyCorner(depth * heft(cast, 0.3, 0.42)),
    arc: 3,
    top: { kind: 'round', size: depth * 0.3 },
    bottom: { kind: 'round', size: 0.02 },
    look: cast.body,
  })
  bar(solid, { axis: 'x', y: body - 0.002, length: shell * 0.8, thick: 0.006, deep: 0.014, look: cast.trim })
  for (const x of [-width * 0.19, width * 0.19]) {
    handle(solid, {
      axis: 'z',
      span: depth * 0.5,
      y0: body - 0.03,
      y1: height,
      thick: 0.011,
      offset: x,
      look: cast.trim,
    })
  }
  // an end panel each side, which is what stops it reading as a cushion
  for (const x of [-1, 1]) {
    solid.block({
      x: (x * (width - 0.016)) / 2,
      width: 0.016,
      depth: depth * 0.62,
      y0: body * 0.14,
      y1: body * 0.82,
      corner: everyCorner(0.02),
      arc: 2,
      look: cast.mark,
    })
  }
}

/** Laid flat with its handle up, the way it stands on a counter. */
export const briefcase: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const shell = height * 0.72
  const seam = shell * 0.5
  const skin = { width: width - 2 * PROUD, depth: depth - 2 * PROUD }
  for (const [y0, y1] of [
    [0, seam - 0.0015],
    [seam + 0.0015, shell],
  ] as const) {
    solid.block({
      ...skin,
      y0,
      y1,
      corner: everyCorner(heft(cast, 0.008, 0.018)),
      arc: 2,
      ...(y1 === shell ? { top: edgeOf(cast, 0.006) } : {}),
      ...(y0 === 0 ? { bottom: edgeOf(cast, 0.006) } : {}),
      look: cast.body,
    })
  }
  // a corner protector at each corner, wrapping the skin it stands on
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      solid.block({
        x: (x * (width - 0.05)) / 2,
        z: (z * (depth - 0.05)) / 2,
        width: 0.05,
        depth: 0.05,
        y0: 0,
        y1: 0.014,
        corner: everyCorner(0.008),
        arc: 2,
        look: cast.trim,
      })
    }
  }
  for (const x of [-width * 0.22, width * 0.22]) {
    solid.block({
      x,
      z: -(depth - 0.01) / 2,
      width: 0.045,
      depth: 0.01,
      y0: seam - 0.012,
      y1: seam + 0.012,
      corner: everyCorner(0.004),
      arc: 2,
      look: cast.mark,
    })
  }
  handle(solid, { axis: 'x', span: width * 0.34, y0: shell, y1: height, thick: 0.012, look: cast.trim })
}

/** A steel box with a lid seam, two clasps and a handle across it. */
export const toolbox: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const body = height * 0.72
  const lid = body * 0.68
  const skin = { width: width - 2 * PROUD, ...setBack(depth) }
  solid.block({
    ...skin,
    y0: 0,
    y1: lid,
    corner: cornersOf(cast, 0.012),
    bottom: edgeOf(cast, 0.006),
    look: cast.body,
  })
  solid.block({
    width: skin.width - 0.004,
    z: skin.z,
    depth: skin.depth - 0.004,
    y0: lid + 0.002,
    y1: body,
    corner: cornersOf(cast, 0.012),
    top: { kind: 'chamfer', size: 0.012 },
    look: cast.body,
  })
  for (const x of [-width * 0.26, width * 0.26]) {
    solid.block({
      x,
      z: -(depth - 0.008) / 2,
      width: 0.03,
      depth: 0.008,
      y0: lid - 0.014,
      y1: lid + 0.02,
      corner: everyCorner(0.004),
      arc: 2,
      look: cast.trim,
    })
  }
  // a rib pressed down each end, which is what says steel rather than plastic
  for (const x of [-1, 1]) {
    solid.block({
      x: (x * (width - 0.01)) / 2,
      width: 0.01,
      depth: depth * 0.6,
      y0: 0.012,
      y1: lid - 0.012,
      corner: everyCorner(0.004),
      arc: 2,
      look: cast.trim,
    })
  }
  handle(solid, { axis: 'x', span: width * 0.42, y0: body, y1: height, thick: 0.014, look: cast.mark })
}

/** A hard case with a cross on the lid. */
export const medkit: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const seam = height * 0.52
  const lid = height - PROUD
  const skin = { width, ...setBack(depth) }
  const corner = everyCorner(heft(cast, 0.012, 0.024))
  solid.block({
    ...skin,
    y0: 0,
    y1: seam - 0.0015,
    corner,
    arc: 2,
    bottom: { kind: 'round', size: 0.008 },
    look: cast.body,
  })
  solid.block({
    ...skin,
    y0: seam + 0.0015,
    y1: lid,
    corner,
    arc: 2,
    top: { kind: 'round', size: 0.01 },
    look: cast.body,
  })
  const cross = cast.lit ? { ...cast.mark, glow: 0xff5c6e, glowStrength: 1.5 } : cast.mark
  for (const [w, d] of [
    [width * 0.24, depth * 0.11],
    [width * 0.08, depth * 0.34],
  ] as const) {
    solid.block({ width: w, depth: d, y0: lid - BURY, y1: height, look: cross })
  }
  // the catch, and a grab strap along the front
  solid.block({
    z: -(depth - 0.01) / 2,
    width: width * 0.16,
    depth: 0.01,
    y0: seam - 0.012,
    y1: seam + 0.014,
    corner: everyCorner(0.004),
    arc: 2,
    look: cast.trim,
  })
  bar(solid, {
    axis: 'x',
    y: height * 0.22,
    z: -(depth - 0.008) / 2,
    length: width * 0.5,
    thick: 0.018,
    deep: 0.008,
    corner: 0.003,
    look: cast.trim,
  })
}

/** A jerry can: ribbed body, sloped shoulders, a spout and a bar over the top. */
export const fuelcan: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const body = height * 0.79
  const shoulder = body + height * 0.07
  const skin = { width, depth: depth - 2 * PROUD, corner: everyCorner(0.022), arc: 2 }
  solid.block({ ...skin, y0: 0, y1: body, bottom: { kind: 'chamfer', size: 0.008 }, look: cast.body })
  solid.block({ ...skin, y0: body, y1: shoulder, topInset: 0.018, look: cast.body })
  for (const x of [-width * 0.24, width * 0.24]) {
    for (const z of [-1, 1]) {
      solid.block({
        x,
        z: z * ((depth - PROUD - BURY) / 2),
        width: 0.014,
        depth: PROUD + BURY,
        y0: 0.03,
        y1: body - 0.03,
        corner: everyCorner(0.003),
        arc: 2,
        look: cast.trim,
      })
    }
  }
  const spout = 0.05
  solid.block({
    x: width * 0.28,
    width: spout,
    depth: spout,
    corner: spout / 2,
    arc: 2,
    y0: shoulder - 0.004,
    y1: height - 0.012,
    look: cast.trim,
  })
  solid.block({
    x: width * 0.28,
    width: spout + 0.006,
    depth: spout + 0.006,
    corner: (spout + 0.006) / 2,
    arc: 2,
    y0: height - 0.014,
    y1: height,
    look: cast.mark,
  })
  handle(solid, {
    axis: 'x',
    span: width * 0.42,
    y0: shoulder - 0.006,
    y1: height - 0.012,
    thick: 0.016,
    look: cast.trim,
  })
}
