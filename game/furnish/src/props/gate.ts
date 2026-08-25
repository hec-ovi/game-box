import { everyCorner } from '../build/outline.ts'
import { bar } from '../build/bar.ts'
import { RED_LAMP } from '../style/lit.ts'
import { cornersOf } from '../style/variant.ts'
import type { PropBuilder } from './builder.ts'

/**
 * A gate of steel bars across a doorway: two posts and a head in the wall's
 * own thickness, and a barred leaf hung between them.
 *
 * It stands at the locked door's own position, so the posts sit in the hole
 * `@gb/scene` cuts and the leaf fills the opening. Built `open`, the leaf has
 * slid sideways along its head into the wall beside the doorway, which is
 * solid, so it disappears and the opening is clear. The posts stay, so what
 * the player walks through still reads as a gate.
 */

const POST = { width: 0.08, depth: 0.18 }
const LEAF = { stile: 0.03, rail: 0.04, bar: 0.02, pitch: 0.1, depth: 0.03 }
/** How far the leaf slides to clear the opening: its own width and the gap it leaves. */
const SLIDE = 0.88

export const barsDoor: PropBuilder = (build) => {
  const { solid, variant, width, height, open } = build
  const { palette } = variant
  const post = POST.width / 2

  for (const side of [-1, 1]) {
    solid.block({
      x: side * (width / 2 - post),
      width: POST.width,
      depth: POST.depth,
      y0: 0,
      y1: height,
      corner: cornersOf(variant, 0.01),
      look: palette.frame,
    })
  }
  bar(solid, {
    axis: 'x',
    y: height - 0.05,
    length: width - 2 * POST.width,
    thick: 0.06,
    deep: POST.depth - 0.04,
    corner: 0.008,
    look: palette.frame,
  })

  const inner = width / 2 - POST.width
  const slide = open ? SLIDE : 0
  const stile = LEAF.stile / 2
  for (const side of [-1, 1]) {
    solid.block({
      x: slide + side * (inner - stile - 0.01),
      width: LEAF.stile,
      depth: LEAF.depth,
      y0: 0.04,
      y1: height - 0.1,
      corner: everyCorner(0.006),
      arc: 2,
      look: palette.frame,
    })
  }
  for (const y of [0.04 + LEAF.rail / 2, 1.02, height - 0.1 - LEAF.rail / 2]) {
    bar(solid, {
      axis: 'x',
      x: slide,
      y,
      length: 2 * (inner - 0.01),
      thick: LEAF.rail,
      deep: LEAF.depth,
      corner: 0.006,
      look: palette.frame,
    })
  }
  const bars = Math.floor((2 * (inner - LEAF.stile - 0.02)) / LEAF.pitch)
  for (let at = 0; at < bars; at++) {
    const x = slide + (at - (bars - 1) / 2) * LEAF.pitch
    solid.block({
      x,
      width: LEAF.bar,
      depth: LEAF.bar,
      y0: 0.04 + LEAF.rail,
      y1: height - 0.1 - LEAF.rail,
      corner: everyCorner(LEAF.bar / 2),
      arc: 3,
      look: palette.frame,
    })
  }
  // the lock box on the closing stile, with its lamp
  solid.block({
    x: slide - inner + 0.09,
    width: 0.1,
    depth: LEAF.depth + 0.02,
    y0: 0.92,
    y1: 1.12,
    corner: cornersOf(variant, 0.008),
    look: palette.shell,
  })
  solid.block({
    x: slide - inner + 0.09,
    z: -(LEAF.depth + 0.02) / 2 - 0.002,
    width: 0.03,
    depth: 0.004,
    y0: 1.06,
    y1: 1.08,
    corner: everyCorner(0.002),
    arc: 2,
    look: open ? palette.glow : RED_LAMP,
  })
}
