import type { Solid } from '../build/solid.ts'
import { everyCorner } from '../build/outline.ts'
import { cornersOf, edgeOf } from '../style/variant.ts'
import { WALL } from './bays.ts'
import type { BayFrame } from './draw.ts'

/**
 * The booth a dance floor is played from: a console standing off the wall
 * with its top at hand height exactly, two platters and a mixer on it, a lit
 * strip along its foot and a band across its front, and a rack of meters on
 * the wall over it, each one lit to a different height.
 *
 * It is the deepest bay in the vocabulary at 28 cm, still inside the 35 cm the
 * player's radius holds them off a wall, so it stays decoration and never a
 * blocker. Its top is a surface a body can put a drink down on, so it is
 * reported through `standsOn` the way a shelf is.
 */
const ARC = 2
const SEAM = WALL.panel.gap
const PLATTER = 0.09
const METERS = 5

export function drawBooth(solid: Solid, bay: BayFrame): void {
  const { variant, half, rng } = bay
  const { palette } = variant
  const booth = WALL.booth
  const inner = half - SEAM
  const slab = 0.04
  bay.standsOn(booth.top)

  // the fascia and the top slab
  solid.block({
    width: 2 * inner,
    depth: booth.depth - 0.02,
    z: (booth.depth - 0.02) / 2,
    y0: booth.low,
    y1: booth.top - slab,
    look: palette.shell,
    corner: cornersOf(variant, 0.02),
    arc: ARC,
  })
  solid.block({
    width: 2 * inner,
    depth: booth.depth,
    z: booth.depth / 2,
    y0: booth.top - slab,
    y1: booth.top,
    look: palette.top,
    corner: cornersOf(variant, 0.03),
    arc: ARC,
    top: edgeOf(variant, 0.01),
  })
  for (const [y0, y1] of [
    [booth.low + 0.02, booth.low + 0.035],
    [booth.top - slab - 0.3, booth.top - slab - 0.27],
  ] as const) {
    solid.block({ width: 2 * inner - 0.08, depth: 0.012, z: booth.depth - 0.02 + 0.006, y0, y1, look: palette.glow, arc: ARC })
  }

  // two platters and the mixer between them
  for (const side of [-1, 1]) {
    solid.block({
      x: side * (inner - PLATTER - 0.05),
      z: booth.depth / 2 + 0.01,
      width: 2 * PLATTER,
      depth: 2 * PLATTER,
      y0: booth.top,
      y1: booth.top + 0.015,
      corner: everyCorner(PLATTER),
      arc: 4,
      look: palette.frame,
    })
    solid.block({
      x: side * (inner - PLATTER - 0.05),
      z: booth.depth / 2 + 0.01,
      width: 0.02,
      depth: 0.02,
      y0: booth.top + 0.015,
      y1: booth.top + 0.025,
      corner: everyCorner(0.01),
      arc: ARC,
      look: palette.glow,
    })
  }
  const mixer = Math.max(0.1, 2 * (inner - 2 * PLATTER - 0.16))
  solid.block({
    z: booth.depth / 2 + 0.02,
    width: mixer,
    depth: 0.16,
    y0: booth.top,
    y1: booth.top + 0.03,
    corner: cornersOf(variant, 0.01),
    arc: ARC,
    look: palette.shell,
  })
  solid.block({ z: booth.depth / 2 - 0.05, width: mixer - 0.03, depth: 0.01, y0: booth.top + 0.03, y1: booth.top + 0.036, look: palette.glow, arc: ARC })

  // the rack of meters on the wall over it
  const rack = booth.rack
  solid.block({
    width: 2 * inner - 0.1,
    depth: rack.depth,
    z: rack.depth / 2,
    y0: rack.low,
    y1: rack.high,
    look: palette.shell,
    corner: cornersOf(variant, 0.012),
    arc: ARC,
  })
  const pitch = (2 * inner - 0.2) / METERS
  for (let at = 0; at < METERS; at++) {
    const x = -inner + 0.1 + (at + 0.5) * pitch
    const level = rng.fork(`meter${at}`).range(0.3, 0.9)
    solid.block({
      x,
      width: Math.min(0.04, pitch * 0.5),
      depth: 0.012,
      z: rack.depth + 0.006,
      y0: rack.low + 0.05,
      y1: rack.low + 0.05 + (rack.high - rack.low - 0.1) * level,
      look: palette.glow,
      arc: ARC,
    })
  }
}
