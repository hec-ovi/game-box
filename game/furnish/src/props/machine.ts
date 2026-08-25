import { everyCorner } from '../build/outline.ts'
import { cornersOf, edgeOf } from '../style/variant.ts'
import { PANELS, glassOf, panelFrame, panelHeight, type Panel } from '../machines/panel.ts'
import type { Build, PropBuilder } from './builder.ts'

/**
 * The four machines a body works at: a desktop, a laptop, a tablet on a stand
 * and a bare monitor. Every one stands on a desk or a counter at that host's
 * top, the way a till does, and every one is a panel from `PANELS` on a base
 * of its own.
 *
 * The glass is drawn lit and idle in the `readout` look. What the machine is
 * running is not the builder's to know: the room prints it over this glass,
 * in `glassFrame`, so a hundred terminals are one buffer and each shows its own
 * ledger.
 */

export const terminal: PropBuilder = (build) => {
  const { solid, variant, width, depth, height } = build
  const { palette } = variant
  // the base unit, with a lit slot and a diode on its front
  solid.block({
    z: 0.12,
    width: width - 0.04,
    depth: 0.26,
    y0: 0,
    y1: 0.07,
    corner: cornersOf(variant, 0.02),
    top: edgeOf(variant, 0.008),
    look: palette.shell,
  })
  solid.block({ z: -0.011, width: 0.18, depth: 0.004, y0: 0.028, y1: 0.036, look: palette.readout })
  diode(build, { x: -width * 0.34, y: 0.03, z: -0.011 })
  // the keyboard in front, a slab with a raised key field
  solid.block({
    z: -depth / 2 + 0.085,
    width: width - 0.08,
    depth: 0.15,
    y0: 0,
    y1: 0.018,
    corner: cornersOf(variant, 0.012),
    look: palette.frame,
  })
  solid.block({ z: -depth / 2 + 0.085, width: width - 0.11, depth: 0.12, y0: 0.018, y1: 0.024, look: palette.shell })
  solid.block({ z: 0.16, width: 0.06, depth: 0.04, y0: 0.07, y1: PANELS.terminal.y, look: palette.frame })
  panel(build, PANELS.terminal, height)
}

export const laptop: PropBuilder = (build) => {
  const { solid, variant, width, depth, height } = build
  const { palette } = variant
  solid.block({
    width: width - 0.02,
    depth: depth - 0.04,
    y0: 0,
    y1: 0.018,
    corner: cornersOf(variant, 0.012),
    top: edgeOf(variant, 0.006),
    look: palette.shell,
  })
  solid.block({ z: 0.02, width: width - 0.08, depth: 0.1, y0: 0.018, y1: 0.022, look: palette.frame })
  solid.block({ z: -0.085, width: 0.08, depth: 0.05, y0: 0.018, y1: 0.021, look: palette.frame })
  panel(build, PANELS.laptop, height)
}

export const tablet: PropBuilder = (build) => {
  const { solid, variant, width, depth, height } = build
  const { palette } = variant
  const stand = PANELS.tablet
  // the stand: a foot, and a wedge the slab leans on
  solid.block({
    width: 0.18,
    depth: depth - 0.02,
    y0: 0,
    y1: 0.01,
    corner: cornersOf(variant, 0.015),
    top: edgeOf(variant, 0.004),
    look: palette.frame,
  })
  solid.block({
    z: 0.02,
    width: 0.1,
    depth: 0.03,
    y0: 0.01,
    y1: 0.075,
    corner: everyCorner(0.006),
    topInset: 0.01,
    look: palette.frame,
  })
  solid.block({ z: stand.z - 0.012, width: width * 0.7, depth: 0.014, y0: 0.01, y1: 0.02, look: palette.frame })
  panel(build, stand, height)
}

export const monitor: PropBuilder = (build) => {
  const { solid, variant, depth, height } = build
  const { palette } = variant
  solid.block({
    width: 0.5,
    depth: depth - 0.02,
    y0: 0,
    y1: 0.015,
    corner: cornersOf(variant, 0.02),
    top: edgeOf(variant, 0.006),
    look: palette.frame,
  })
  solid.block({ z: 0.03, width: 0.08, depth: 0.05, y0: 0.015, y1: PANELS.monitor.y + 0.02, look: palette.frame })
  panel(build, PANELS.monitor, height)
}

/**
 * The slab and the glass in it, in the panel's own frame. The glass stands a
 * millimetre proud of the bezel so it is a face of its own, and the print the
 * room lays over it stands another millimetre off that.
 */
function panel(build: Build, spec: Panel, top: number): void {
  const { solid, variant } = build
  const { palette } = variant
  const height = panelHeight(spec, top)
  const glass = glassOf(spec, top)
  solid.in(panelFrame(spec), () => {
    solid.block({
      width: spec.width,
      depth: spec.thick,
      y0: 0,
      y1: height,
      corner: cornersOf(variant, Math.min(0.012, spec.thick / 2)),
      look: palette.shell,
    })
    solid.block({
      z: -spec.thick / 2,
      width: glass.width,
      depth: 0.002,
      y0: glass.y,
      y1: glass.y + glass.height,
      look: palette.readout,
    })
  })
}

/** The one diode on a machine: a dot of light on the base unit. */
function diode(build: Build, at: { x: number; y: number; z: number }): void {
  build.solid.block({
    x: at.x,
    z: at.z,
    width: 0.008,
    depth: 0.004,
    y0: at.y - 0.004,
    y1: at.y + 0.004,
    corner: everyCorner(0.002),
    arc: 2,
    look: build.variant.palette.glow,
  })
}
