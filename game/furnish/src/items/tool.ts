/**
 * The things that are neither paper nor a container: a key, a wrench, a phone,
 * a radio, a cut stone, a figurine.
 *
 * Each is small enough that the silhouette is all anybody reads, so each is
 * built from the two or three parts that make that silhouette and nothing else:
 * a bow and a bitted shaft, two jaws on a shank, a lit rectangle, a grille and
 * an aerial, facets, a plinth and a head.
 */
import { bar, handle } from '../build/bar.ts'
import { everyCorner } from '../build/outline.ts'
import { cornersOf, edgeOf, heft } from '../style/variant.ts'
import { BURY, facing, setBack, type ItemBuilder } from './builder.ts'
import { MATTER } from './matter.ts'

export const key: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const flat = height * 0.6
  const bow = depth * 0.9
  solid.block({
    x: -(width - bow) / 2,
    width: bow,
    depth: bow,
    corner: bow / 2,
    arc: 2,
    y0: 0,
    y1: flat,
    look: cast.body,
  })
  solid.block({
    x: -(width - bow) / 2,
    width: bow * 0.38,
    depth: bow * 0.38,
    corner: bow * 0.19,
    arc: 2,
    y0: flat - BURY,
    y1: flat + 0.0003,
    look: cast.mark,
  })
  const shaft = width - bow
  solid.block({
    x: bow / 2,
    width: shaft,
    depth: 0.0055,
    y0: 0,
    y1: flat,
    corner: everyCorner(0.00275),
    arc: 2,
    look: cast.body,
  })
  for (const [at, run] of [
    [0.62, 0.006],
    [0.78, 0.004],
    [0.92, 0.005],
  ] as const) {
    solid.block({
      x: -width / 2 + width * at,
      z: 0.004,
      width: run,
      depth: 0.006,
      y0: 0,
      y1: flat,
      look: cast.body,
    })
  }
}

export const wrench: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const flat = height * 0.8
  const jaw = depth * 0.8
  solid.block({
    width: width * 0.68,
    depth: 0.017,
    y0: 0,
    y1: flat,
    corner: everyCorner(0.0085),
    arc: 2,
    top: edgeOf(cast, 0.003),
    look: cast.body,
  })
  // the open end: two jaws off a back
  for (const z of [-1, 1]) {
    solid.block({
      x: -width * 0.41,
      z: z * (jaw / 2 - 0.006),
      width: width * 0.13,
      depth: 0.012,
      y0: 0,
      y1: flat,
      corner: everyCorner(0.004),
      arc: 2,
      look: cast.body,
    })
  }
  solid.block({
    x: -(width / 2 - 0.007),
    width: 0.014,
    depth: jaw,
    y0: 0,
    y1: flat,
    corner: everyCorner(0.005),
    arc: 2,
    look: cast.body,
  })
  // the ring end, with the hole read as a darker disc rather than a real annulus
  solid.block({
    x: width / 2 - jaw / 2,
    width: jaw,
    depth: jaw,
    corner: jaw / 2,
    arc: 3,
    y0: 0,
    y1: flat,
    top: edgeOf(cast, 0.002),
    look: cast.body,
  })
  solid.block({
    x: width / 2 - jaw / 2,
    width: jaw * 0.56,
    depth: jaw * 0.56,
    corner: jaw * 0.28,
    arc: 3,
    y0: flat - BURY,
    y1: flat + 0.0005,
    look: cast.mark,
  })
  // a knurled grip band across the shank
  solid.block({
    width: width * 0.24,
    depth: 0.019,
    y0: 0.0004,
    y1: flat + 0.0006,
    corner: everyCorner(0.003),
    arc: 2,
    look: cast.trim,
  })
}

export const phone: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const back = height - 0.0012
  solid.block({
    width,
    depth,
    y0: 0,
    y1: back,
    corner: everyCorner(0.009),
    arc: 3,
    top: edgeOf(cast, 0.0008),
    look: cast.body,
  })
  solid.block({
    width: width - 0.005,
    depth: depth - 0.02,
    y0: back - BURY,
    y1: height,
    corner: everyCorner(0.007),
    arc: 3,
    look: cast.lit ? cast.mark : MATTER.ink,
  })
  // the earpiece slot, clear of the screen so the two do not share a plane
  solid.block({
    z: -(depth / 2 - 0.006),
    width: width * 0.3,
    depth: 0.003,
    y0: back - BURY,
    y1: height,
    look: cast.trim,
  })
}

export const radio: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const body = height * 0.47
  const face = facing(depth)
  solid.block({
    width,
    ...setBack(depth),
    y0: 0,
    y1: body,
    corner: cornersOf(cast, 0.014),
    arc: 2,
    top: edgeOf(cast, 0.008),
    look: cast.body,
  })
  for (let slot = 0; slot < 5; slot++) {
    const y0 = body * 0.18 + slot * body * 0.13
    solid.block({
      x: -width * 0.18,
      ...face,
      width: width * 0.42,
      y0,
      y1: y0 + body * 0.075,
      look: cast.trim,
    })
  }
  for (const y of [body * 0.32, body * 0.68]) {
    bar(solid, {
      axis: 'z',
      x: width * 0.34,
      y,
      z: -(depth - 0.013) / 2,
      length: 0.013,
      thick: 0.03,
      deep: 0.03,
      corner: 0.015,
      look: cast.trim,
    })
  }
  // the dial window, the one thing on it that can be lit
  solid.block({
    x: -width * 0.18,
    ...face,
    width: width * 0.42,
    y0: body * 0.82,
    y1: body * 0.94,
    look: cast.lit ? cast.mark : MATTER.ink,
  })
  handle(solid, { axis: 'x', span: width * 0.4, y0: body, y1: body + height * 0.09, thick: 0.012, look: cast.trim })
  const aerial = 0.006
  solid.block({
    x: width * 0.4,
    z: depth * 0.25,
    width: aerial,
    depth: aerial,
    corner: aerial / 2,
    arc: 2,
    y0: body - 0.01,
    y1: height,
    topInset: aerial * 0.3,
    look: cast.trim,
  })
}

/**
 * A cut stone: a pavilion drawn to a point, a girdle, a crown up to the table.
 * Eight facets, which is two arc steps on a full corner radius: one step gives
 * a diamond in plan and reads as a shard rather than a stone.
 */
export const gem: ItemBuilder = ({ solid, cast, width, height }) => {
  const facets = { width, depth: width, corner: width / 2, arc: 2 }
  const girdle = height * heft(cast, 0.42, 0.54)
  solid.block({ ...facets, y0: 0, y1: girdle, bottomInset: width / 2 - 0.0025, look: cast.body })
  solid.block({ ...facets, y0: girdle, y1: girdle + 0.0025, look: cast.trim })
  solid.block({ ...facets, y0: girdle + 0.0025, y1: height, topInset: width * 0.3, look: cast.body })
}

/** A figurine: a plinth, a robe, shoulders and arms, a neck, a head. */
export const statue: ItemBuilder = ({ solid, cast, width, depth, height }) => {
  const plinth = width * 0.8
  solid.block({
    width: plinth,
    depth: plinth,
    y0: 0,
    y1: height * 0.1,
    corner: cornersOf(cast, 0.01),
    top: { kind: 'chamfer', size: 0.008 },
    look: cast.trim,
  })
  const robe = width * 0.66
  solid.block({
    width: robe,
    depth: robe * 0.7,
    corner: everyCorner(robe * 0.3),
    arc: 3,
    y0: height * 0.08,
    y1: height * 0.62,
    topInset: robe * 0.26,
    look: cast.body,
  })
  solid.block({
    width: width * 0.5,
    depth: depth * 0.3,
    corner: everyCorner(width * 0.14),
    arc: 3,
    y0: height * 0.6,
    y1: height * 0.72,
    top: { kind: 'round', size: 0.014 },
    look: cast.body,
  })
  bar(solid, {
    axis: 'x',
    y: height * 0.64,
    length: width * 0.76,
    thick: 0.02,
    deep: 0.026,
    corner: 0.009,
    look: cast.body,
  })
  const head = width * 0.3
  solid.block({
    width: head * 0.55,
    depth: head * 0.55,
    corner: head * 0.275,
    arc: 2,
    y0: height * 0.68,
    y1: height * 0.78,
    look: cast.body,
  })
  solid.block({
    width: head,
    depth: head * 0.88,
    corner: everyCorner(head / 2),
    arc: 3,
    y0: height * 0.76,
    y1: height,
    bottomInset: head * 0.2,
    topInset: head * 0.26,
    look: cast.lit ? cast.mark : cast.body,
  })
}
