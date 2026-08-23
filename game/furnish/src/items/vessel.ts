/**
 * The round things: a bottle, a drinking glass, a cup, a plate, a cut flower.
 *
 * A full corner radius on a square plan is a cylinder, so all of these come out
 * of the same primitive as everything else. They are drawn at twelve sides,
 * sixteen where the silhouette is the whole read: a bottle at arm's length is a
 * shoulder and a neck, and both of those are the section, not the plan.
 */
import * as THREE from 'three'
import { bar } from '../build/bar.ts'
import { MATTER } from './matter.ts'
import { heft } from '../style/variant.ts'
import type { ItemBuilder } from './builder.ts'

const ROUND = 3
const PLAIN = 2

/** A cylinder of a given diameter: the plan every one of these is drawn on. */
function round(diameter: number, arc = ROUND) {
  return { width: diameter, depth: diameter, corner: diameter / 2, arc }
}

export const bottle: ItemBuilder = ({ solid, cast, width, height }) => {
  const barrel = width - 0.0016
  const body = height * heft(cast, 0.52, 0.6)
  const shoulder = body + height * 0.16
  const neck = width * 0.34

  solid.block({
    ...round(barrel),
    y0: 0,
    y1: body,
    bottomInset: 0.003,
    bottom: { kind: 'chamfer', size: 0.004 },
    look: cast.body,
  })
  solid.block({ ...round(barrel), y0: body, y1: shoulder, topInset: (barrel - neck) / 2, look: cast.body })
  solid.block({ ...round(neck, PLAIN), y0: shoulder, y1: height - 0.015, look: cast.body })
  solid.block({ ...round(neck + 0.004, PLAIN), y0: height - 0.018, y1: height, look: cast.trim })
  // the label is a band round the belly, not a decal on one face
  solid.block({
    ...round(width),
    y0: body * 0.28,
    y1: body * 0.78,
    look: cast.lit ? cast.mark : cast.trim,
  })
}

export const glass: ItemBuilder = ({ solid, cast, width, height }) => {
  const wall = width - 0.0016
  solid.block({
    ...round(wall),
    y0: 0,
    y1: height - 0.004,
    bottomInset: wall * 0.07,
    bottom: { kind: 'chamfer', size: 0.003 },
    look: cast.body,
  })
  // what is in it: seen as a band of colour, because nothing here is transparent
  solid.block({
    ...round(width - 0.0008),
    y0: height * 0.12,
    y1: height * heft(cast, 0.4, 0.62),
    look: cast.mark,
  })
  // the rim is the only thing with a face at the top, so nothing shares a plane there
  solid.block({ ...round(width), y0: height - 0.008, y1: height, look: cast.trim })
}

export const cup: ItemBuilder = ({ solid, cast, depth, height }) => {
  const body = depth - 0.001
  const thick = 0.009
  const out = body / 2 + 0.018
  // the handle hangs off one side, so the whole cup shifts to stand on its own middle
  const middle = (out + thick / 2 - body / 2) / 2
  solid.in(new THREE.Matrix4().makeTranslation(-middle, 0, 0), () => {
    solid.block({ ...round(body), y0: 0, y1: height - 0.005, bottomInset: body * 0.09, look: cast.body })
    solid.block({ ...round(depth), y0: height - 0.009, y1: height, look: cast.mark })
    solid.block({
      x: out,
      ...round(thick, PLAIN),
      y0: height * 0.28,
      y1: height * 0.76,
      look: cast.body,
    })
    for (const y of [height * 0.3, height * 0.74]) {
      bar(solid, { axis: 'x', x: (body / 2 + out) / 2, y, length: out - body / 2 + thick, thick, look: cast.body })
    }
  })
}

export const plate: ItemBuilder = ({ solid, cast, width, height }) => {
  const well = height - 0.0018
  solid.block({ ...round(width * 0.42, PLAIN), y0: 0, y1: height * 0.3, look: cast.body })
  // the body's own top face is the well: full width, flat, at `well`
  solid.block({
    ...round(width, 4),
    y0: height * 0.25,
    y1: well,
    bottomInset: width * 0.2,
    look: cast.body,
  })
  // the rim: a shallow open cone standing on the well, so what you look down
  // into is the well rather than a lid over it. It starts under the well's face
  // so the two never share a plane and the shadow pass has nothing to fight over
  solid.block({
    ...round(width, 4),
    y0: well - 0.0006,
    y1: height,
    topInset: width * 0.13,
    openTop: true,
    look: cast.lit ? cast.mark : cast.body,
  })
}

/** One cut stem in a paper wrap: the thing somebody carries across town. */
export const flower: ItemBuilder = ({ solid, cast, width, height }) => {
  const wrap = width * 0.64
  // the paper it was sold in: paper whatever the bloom is
  solid.block({
    ...round(wrap, PLAIN),
    y0: 0,
    y1: height * 0.24,
    bottomInset: wrap * 0.28,
    look: MATTER.kraft,
  })
  solid.block({ ...round(0.008, PLAIN), y0: height * 0.06, y1: height * 0.8, look: cast.trim })
  for (const [side, at] of [
    [1, 0.42],
    [-1, 0.56],
  ] as const) {
    bar(solid, {
      axis: 'x',
      x: (side * width) / 5,
      y: height * at,
      length: width * 0.34,
      thick: 0.003,
      deep: 0.018,
      look: cast.trim,
    })
  }
  const bloom = width * heft(cast, 0.62, 0.86)
  solid.block({
    ...round(bloom),
    y0: height * 0.78,
    y1: height * 0.94,
    bottomInset: bloom * 0.34,
    look: cast.body,
  })
  solid.block({ ...round(bloom * 0.34, PLAIN), y0: height * 0.92, y1: height, look: cast.mark })
}
