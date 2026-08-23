import type { Look } from './look.ts'
import { everyCorner } from './outline.ts'
import type { Solid } from './solid.ts'
import { cornersOf, edgeOf, heft, type Variant } from '../style/variant.ts'

/**
 * The sub-assemblies more than one prop is made of: what holds a piece off the
 * floor, the strip of light along its edge, and the divided front of a case.
 *
 * Keeping them here is what stops a desk and a counter from drifting apart: a
 * variant that says "thin metal frame" means the same frame under both.
 */

/** What a piece stands on, from the floor up to `top`. */
export function support(
  solid: Solid,
  variant: Variant,
  spec: { width: number; depth: number; top: number; look?: Look; inset?: number },
): void {
  const look = spec.look ?? variant.palette.frame
  const inset = spec.inset ?? 0.04
  switch (variant.support) {
    case 'post':
      return posts(solid, variant, spec, look, inset)
    case 'frame':
      return frame(solid, spec, look, inset)
    case 'panel':
      return panels(solid, variant, spec, look)
    case 'plinth':
      return plinth(solid, variant, spec, look)
  }
}

/** Four legs, square or turned round depending on the language. */
function posts(
  solid: Solid,
  variant: Variant,
  spec: { width: number; depth: number; top: number },
  look: Look,
  inset: number,
): void {
  const side = heft(variant, 0.04, 0.07)
  const corner = variant.edge === 'round' ? side / 2 : Math.min(variant.radius, side / 3)
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      solid.block({
        x: (x * (spec.width - side)) / 2 - x * inset,
        z: (z * (spec.depth - side)) / 2 - z * inset,
        width: side,
        depth: side,
        y0: 0,
        y1: spec.top,
        corner: everyCorner(corner),
        look,
      })
    }
  }
}

/** A thin metal frame: a hoop at each end and a stretcher between them. */
function frame(
  solid: Solid,
  spec: { width: number; depth: number; top: number },
  look: Look,
  inset: number,
): void {
  const bar = 0.03
  const rail = Math.min(0.12, spec.top / 3)
  for (const side of [-1, 1]) {
    const x = (side * (spec.width - bar)) / 2 - side * inset
    solid.block({ x, width: bar, depth: spec.depth - 2 * inset, y0: spec.top - bar, y1: spec.top, look })
    for (const z of [-1, 1]) {
      solid.block({
        x,
        z: (z * (spec.depth - bar)) / 2 - z * inset,
        width: bar,
        depth: bar,
        y0: 0,
        y1: spec.top,
        look,
      })
    }
  }
  solid.block({ width: spec.width - 2 * inset - bar, depth: bar, y0: rail, y1: rail + bar, look })
}

/** A gable each end: the piece is a shell rather than a table. */
function panels(
  solid: Solid,
  variant: Variant,
  spec: { width: number; depth: number; top: number },
  look: Look,
): void {
  const thick = heft(variant, 0.03, 0.05)
  for (const side of [-1, 1]) {
    solid.block({
      x: (side * (spec.width - thick)) / 2,
      width: thick,
      depth: spec.depth,
      y0: 0,
      y1: spec.top,
      corner: cornersOf(variant, thick / 2),
      look,
    })
  }
}

/** A recessed base block with a shadow gap under it. */
function plinth(
  solid: Solid,
  variant: Variant,
  spec: { width: number; depth: number; top: number },
  look: Look,
): void {
  const toe = Math.min(0.08, spec.top / 4)
  const back = 0.05
  solid.block({
    width: spec.width - 2 * back,
    depth: spec.depth - 2 * back,
    y0: 0,
    y1: toe,
    corner: cornersOf(variant),
    look,
  })
  // no lid: the piece it holds up covers it, and a hidden plate that wide would
  // read as the widest level surface on the prop. Held a few millimetres inside
  // the footprint as well, so a cove along the front is not buried in it.
  solid.block({
    width: spec.width - 0.012,
    depth: spec.depth - 0.012,
    y0: toe,
    y1: spec.top,
    corner: cornersOf(variant),
    bottom: edgeOf(variant, Math.min(0.02, toe)),
    openTop: true,
    look,
  })
}

/**
 * A line of light. Architecture in both languages, so it is the same shape in
 * both, and never a panel: a strip that covered any real area would read as the
 * widest level surface on the piece it is tucked under.
 */
export function strip(
  solid: Solid,
  variant: Variant,
  spec: { x?: number; z?: number; width: number; depth: number; y: number; thickness?: number },
): void {
  const thickness = spec.thickness ?? 0.015
  solid.block({
    ...(spec.x === undefined ? {} : { x: spec.x }),
    ...(spec.z === undefined ? {} : { z: spec.z }),
    width: spec.width,
    depth: spec.depth,
    y0: spec.y,
    y1: spec.y + thickness,
    corner: everyCorner(thickness / 2),
    arc: 2,
    openTop: true,
    look: variant.palette.glow,
  })
}

/**
 * The front of a case: `count` leaves filling the slice of depth between
 * `front` and `front + thickness`, each with a finger channel down its closing
 * edge. What a wardrobe, a cabinet and a fridge all have.
 *
 * The leaves live inside the footprint, never proud of it, because the
 * footprint is cells the planner claimed and a handle is not allowed to reach
 * into the walkway.
 */
export function doors(
  solid: Solid,
  variant: Variant,
  spec: {
    width: number
    front: number
    thickness: number
    y0: number
    y1: number
    count: number
    look?: Look
  },
): void {
  const look = spec.look ?? variant.palette.shell
  const gap = 0.008
  const leaf = (spec.width - gap * (spec.count + 1)) / spec.count
  for (let at = 0; at < spec.count; at++) {
    const x = -spec.width / 2 + gap + leaf / 2 + at * (leaf + gap)
    const set = 0.004
    solid.block({
      x,
      z: spec.front + set + (spec.thickness - set) / 2,
      width: leaf,
      depth: spec.thickness - set,
      y0: spec.y0 + gap,
      y1: spec.y1 - gap,
      corner: cornersOf(variant, leaf / 2),
      top: edgeOf(variant, 0.01),
      bottom: edgeOf(variant, 0.01),
      look,
    })
    // the grip stands proud of the leaf and flush with the footprint, never past it
    const towards = at < spec.count / 2 ? 1 : -1
    solid.block({
      x: x + (towards * leaf) / 2 - towards * 0.035,
      z: spec.front + spec.thickness / 2,
      width: 0.016,
      depth: spec.thickness,
      y0: (spec.y0 + spec.y1) / 2 - 0.1,
      y1: (spec.y0 + spec.y1) / 2 + 0.1,
      corner: everyCorner(0.008),
      arc: 2,
      look: variant.palette.frame,
    })
  }
}

/**
 * A sunken basin: four rails round a hole and a floor under it, so the recess
 * is a real hollow with faces looking into it rather than a hole you see the
 * back of. The rails' tops are the worktop, all at `top`.
 */
export function recess(
  solid: Solid,
  variant: Variant,
  spec: {
    width: number
    depth: number
    hole: number
    holeDepth: number
    top: number
    deep: number
    look: Look
    floor?: Look
  },
): void {
  const side = (spec.width - spec.hole) / 2
  const front = (spec.depth - spec.holeDepth) / 2
  const y0 = spec.top - spec.deep
  const edge = edgeOf(variant, 0.008)
  for (const way of [-1, 1]) {
    solid.block({
      x: (way * (spec.width - side)) / 2,
      width: side,
      depth: spec.depth,
      y0,
      y1: spec.top,
      top: edge,
      look: spec.look,
    })
    solid.block({
      z: (way * (spec.depth - front)) / 2,
      width: spec.hole,
      depth: front,
      y0,
      y1: spec.top,
      top: edge,
      look: spec.look,
    })
  }
  solid.block({
    width: spec.hole,
    depth: spec.holeDepth,
    y0: y0 - 0.02,
    y1: y0 + 0.01,
    look: spec.floor ?? spec.look,
  })
}
