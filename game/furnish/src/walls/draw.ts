/**
 * What a bay looks like.
 *
 * Every bay is drawn in its own frame: x across the bay from the middle, y off
 * the floor, z out of the wall into the room. So one builder per kind is all
 * the geometry there is, and which wall it lands on is a matrix.
 *
 * Everything comes out of `Solid.block`, the same extrusion the furniture is
 * made of, on the same one material, so a whole room of walls is one buffer.
 * Nothing here recesses into the wall: a bay stands off the face by at most
 * `BAY_SPECS[kind].depth`, and what reads as a recess is the surround round it
 * standing proud of the base wall.
 */
import type { Rng } from '@gb/kit'
import type { Solid } from '../build/solid.ts'
import { cornersOf, edgeOf, type Variant } from '../style/variant.ts'
import { SHELF_LEDGES, WALL, type BayKind } from './bays.ts'
import { drawBooth } from './booth.ts'
import { standThings } from './things.ts'

/** Air left at each end of a bay, so the seam between two of them reads. */
const SEAM = WALL.panel.gap

/**
 * Points per rounded corner on a wall. Two, not the catalog's four: a bay's
 * radius is capped by how thin it is, so a 6 mm fillet at four steps is
 * triangles nobody can see. It is the whole difference between a moulded room
 * costing 35,000 triangles and costing 14,000.
 */
const ARC = 2

/** Every block a wall is made of, drawn at the wall's own arc. */
function block(solid: Solid, spec: Parameters<Solid['block']>[0]): void {
  solid.block({ arc: ARC, ...spec })
}

export interface BayFrame {
  /** Half the width of the bay, in metres. */
  readonly half: number
  readonly variant: Variant
  readonly rng: Rng
  /** Called with the exact height of every surface the bay lets you put something down on. */
  readonly standsOn: (height: number) => void
}

type Draw = (solid: Solid, bay: BayFrame) => void

export const BAY_DRAWS: Record<BayKind, Draw | undefined> = {
  plain: undefined,
  panel: drawPanel,
  niche: drawNiche,
  shelf: drawShelf,
  frame: drawFrame,
  grille: drawGrille,
  strip: drawStrip,
  window: drawWindow,
  booth: drawBooth,
}

/** The rail over the field of bays, and the lit channel washing down off it. */
export function drawRail(solid: Solid, bay: BayFrame): void {
  const { variant, half } = bay
  const { palette } = variant
  const rail = WALL.rail
  block(solid, {
    width: 2 * half,
    depth: rail.depth,
    z: rail.depth / 2,
    y0: WALL.head,
    y1: rail.top,
    look: palette.board,
    corner: cornersOf(variant, rail.depth / 2),
    bottom: edgeOf(variant, 0.012),
  })
  block(solid, {
    width: 2 * half - 0.04,
    depth: rail.depth - 0.02,
    z: (rail.depth - 0.02) / 2,
    y0: rail.under,
    y1: WALL.head,
    look: palette.glow,
  })
}

function drawPanel(solid: Solid, bay: BayFrame): void {
  const { variant, half, rng } = bay
  const depth = WALL.panel.depth
  block(solid, {
    width: 2 * half - 2 * SEAM,
    depth,
    z: depth / 2,
    y0: WALL.panel.low,
    y1: WALL.head - SEAM,
    look: rng.fork('face').chance(0.1) ? variant.palette.accent : variant.palette.board,
    corner: cornersOf(variant, depth / 2),
    top: edgeOf(variant, 0.012),
    bottom: edgeOf(variant, 0.012),
  })
}

/**
 * A lit recess with something standing in it: a sill, a head, two jambs and a
 * strip under the head. The sill is drawn with its top face at
 * `WALL.niche.sill` exactly, because it is a surface a body puts something on.
 */
function drawNiche(solid: Solid, bay: BayFrame): void {
  const { variant, half, rng } = bay
  bay.standsOn(WALL.niche.sill)
  const { palette } = variant
  const niche = WALL.niche
  const inner = half - SEAM
  const opening = inner - niche.jamb
  const low = niche.sill - niche.reveal
  const high = niche.head + niche.reveal

  block(solid, { width: 2 * opening, depth: 0.012, z: 0.006, y0: low, y1: high, look: palette.shell })
  for (const side of [-1, 1]) {
    block(solid, {
      x: side * (inner - niche.jamb / 2),
      width: niche.jamb,
      depth: niche.depth,
      z: niche.depth / 2,
      y0: low,
      y1: high,
      look: palette.board,
      corner: cornersOf(variant, niche.jamb / 2),
    })
  }
  block(solid, {
    width: 2 * inner,
    depth: niche.depth,
    z: niche.depth / 2,
    y0: low,
    y1: niche.sill,
    look: palette.top,
    corner: cornersOf(variant, niche.depth / 2),
    top: edgeOf(variant, 0.01),
  })
  block(solid, {
    width: 2 * inner,
    depth: niche.depth,
    z: niche.depth / 2,
    y0: niche.head,
    y1: high,
    look: palette.board,
    corner: cornersOf(variant, niche.depth / 2),
    bottom: edgeOf(variant, 0.01),
  })
  block(solid, {
    width: 2 * opening - 0.06,
    depth: 0.03,
    z: 0.028,
    y0: niche.head - 0.05,
    y1: niche.head - 0.012,
    look: palette.glow,
  })

  standThings(
    solid,
    variant,
    { y: niche.sill, half: opening, headroom: niche.head - niche.sill - 0.07, depth: niche.depth, margin: 1 },
    rng.fork('sill'),
  )
}

/**
 * Two or three ledges between cheeks, with things on them. Every ledge is drawn
 * with its top face on the number, the same contract a worktop is held to.
 */
function drawShelf(solid: Solid, bay: BayFrame): void {
  const { variant, half, rng } = bay
  const { palette } = variant
  const shelf = WALL.shelf
  const inner = half - SEAM
  const ledges = rng.fork('ledges').int(2, SHELF_LEDGES)
  const top = shelf.lowest + (ledges - 1) * shelf.pitch
  const low = shelf.lowest - shelf.ledge

  block(solid, { width: 2 * inner, depth: 0.012, z: 0.006, y0: low, y1: top + 0.02, look: palette.frame })
  for (const side of [-1, 1]) {
    block(solid, {
      x: side * (inner - shelf.cheek / 2),
      width: shelf.cheek,
      depth: shelf.depth,
      z: shelf.depth / 2,
      y0: low,
      y1: top + 0.02,
      look: palette.board,
      corner: cornersOf(variant, shelf.cheek / 2),
    })
  }

  const span = inner - shelf.cheek
  for (let at = 0; at < ledges; at++) {
    const y = shelf.lowest + at * shelf.pitch
    bay.standsOn(y)
    block(solid, {
      width: 2 * span,
      depth: shelf.depth,
      z: shelf.depth / 2,
      y0: y - shelf.ledge,
      y1: y,
      look: palette.top,
      corner: cornersOf(variant, shelf.ledge / 2),
      top: edgeOf(variant, 0.008),
    })
    standThings(
      solid,
      variant,
      { y, half: span, headroom: shelf.pitch - shelf.ledge - 0.02, depth: shelf.depth, margin: 1 },
      rng.fork(`ledge${at}`),
    )
  }
}

/** A poster on a raised mount. */
function drawFrame(solid: Solid, bay: BayFrame): void {
  const { variant, half } = bay
  const { palette } = variant
  const frame = WALL.frame
  const inner = Math.min(half - SEAM - 0.06, 0.45)
  block(solid, {
    width: 2 * inner,
    depth: 0.02,
    z: 0.01,
    y0: frame.low,
    y1: frame.high,
    look: palette.frame,
    corner: cornersOf(variant, 0.01),
  })
  block(solid, {
    width: 2 * (inner - frame.border),
    depth: 0.014,
    z: 0.026,
    y0: frame.low + frame.border,
    y1: frame.high - frame.border,
    look: palette.screen,
  })
}

/** Louvres over a dark back: the services on show. */
function drawGrille(solid: Solid, bay: BayFrame): void {
  const { variant, half } = bay
  const { palette } = variant
  const grille = WALL.grille
  const inner = half - SEAM - 0.03
  block(solid, { width: 2 * inner, depth: 0.012, z: 0.006, y0: grille.low, y1: grille.high, look: palette.frame })

  const pitch = (grille.high - grille.low) / grille.slats
  for (let at = 0; at < grille.slats; at++) {
    const y = grille.low + at * pitch
    block(solid, {
      width: 2 * inner - 0.04,
      depth: grille.depth - 0.012,
      z: 0.012 + (grille.depth - 0.012) / 2,
      y0: y + 0.012,
      y1: y + pitch - 0.018,
      look: palette.board,
      corner: cornersOf(variant, 0.006),
      top: edgeOf(variant, 0.006),
    })
  }
}

/** A light line up the wall, in its own channel. */
function drawStrip(solid: Solid, bay: BayFrame): void {
  const { variant, half } = bay
  const { palette } = variant
  const strip = WALL.strip
  const width = Math.min(strip.width, 2 * half - 2 * SEAM)
  block(solid, {
    width,
    depth: 0.02,
    z: 0.01,
    y0: strip.low,
    y1: strip.high,
    look: palette.frame,
    corner: cornersOf(variant, 0.01),
  })
  block(solid, {
    width: width * 0.45,
    depth: 0.016,
    z: 0.028,
    y0: strip.low + 0.06,
    y1: strip.high - 0.06,
    look: palette.glow,
  })
}

/** A pane onto the city, in a frame that stands off the wall. */
function drawWindow(solid: Solid, bay: BayFrame): void {
  const { variant, half } = bay
  const { palette } = variant
  const window = WALL.window
  const inner = half - SEAM - 0.08
  const f = window.frame

  block(solid, { width: 2 * inner, depth: 0.015, z: 0.0075, y0: window.low, y1: window.high, look: palette.pane })
  for (const side of [-1, 1]) {
    block(solid, {
      x: side * (inner + f / 2),
      width: f,
      depth: window.depth,
      z: window.depth / 2,
      y0: window.low - f,
      y1: window.high + f,
      look: palette.board,
      corner: cornersOf(variant, f / 2),
    })
  }
  for (const [y0, y1] of [
    [window.low - f, window.low],
    [window.high, window.high + f],
  ] as const) {
    block(solid, {
      width: 2 * (inner + f),
      depth: window.depth,
      z: window.depth / 2,
      y0,
      y1,
      look: palette.board,
      corner: cornersOf(variant, window.depth / 2),
    })
  }
  block(solid, {
    width: 0.04,
    depth: window.depth - 0.02,
    z: (window.depth - 0.02) / 2,
    y0: window.low,
    y1: window.high,
    look: palette.frame,
  })
}
