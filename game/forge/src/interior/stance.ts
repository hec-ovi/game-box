import type { AnchorKind } from '@gb/world'

/**
 * How close a body stands to the piece it is there for, measured from the
 * body's own point on the floor to the near face of the piece.
 *
 * Two different bodies want two different things and the planner used to give
 * them the same number:
 *
 * - A body **working** at a piece rests its hands on the surface. The standing
 *   working clips put the hands 0.02 to 0.13 m in front of the root, at about
 *   1.03 m off the floor, so the surface has to start where the body does. Any
 *   further back and the hands are over the floor at the right height, which is
 *   what leaves a bartender resting their arms on air.
 * - A body **attending** a piece does not touch it: it looks into a case, waits
 *   at a sink, stands in front of an altar. It wants to see the piece and to be
 *   walked past, so it stands a short step back.
 *
 * A body sitting on a piece is neither: its anchor is inside its own seat, and
 * these bands do not apply to it.
 */
export interface Stance {
  /** Closest the body may be to the face: it stands at the piece, never in it. */
  readonly near: number
  /** Where the planner puts it. */
  readonly at: number
  /** Furthest it may be and still be working at the piece rather than near it. */
  readonly far: number
}

/** Hands on the surface: a body of its own depth, and nothing else, between root and face. */
export const AT_HAND: Stance = { near: 0.1, at: 0.15, far: 0.25 }

/** Facing a piece without touching it: close enough to read it, clear enough to pass behind. */
export const IN_FRONT: Stance = { near: 0.2, at: 0.3, far: 0.45 }

const STANCES: Partial<Record<AnchorKind, Stance>> = {
  serve: AT_HAND,
  cook: AT_HAND,
  'work-desk': AT_HAND,
  browse: IN_FRONT,
  stand: IN_FRONT,
}

/** How a body of this kind stands at a piece, or nothing for one that works at none. */
export function stanceOf(kind: AnchorKind): Stance | undefined {
  return STANCES[kind]
}

/** Floor to leave between a body of this kind and the face of the piece it is at. */
export function standoff(kind: AnchorKind): number {
  return (STANCES[kind] ?? IN_FRONT).at
}
