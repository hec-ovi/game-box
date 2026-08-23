import type { AnchorKind, FurnitureProp } from '@gb/world'
import { seatSpecOf } from './props.ts'

/**
 * Where a body's own point on the floor goes relative to the piece it is there
 * for: standing at it, or sitting on it.
 *
 * Two different standing bodies want two different things and the planner used
 * to give them the same number:
 *
 * - A body **working** at a piece rests its hands on the surface: serving,
 *   cooking, on its feet at a bench. The standing working clips put the hands
 *   0.02 to 0.13 m in front of the root, at about 1.03 m off the floor, so the
 *   surface has to start where the body does. Any further back and the hands are
 *   over the floor at the right height, which is what leaves a bartender resting
 *   their arms on air. A desk is not one of these: a body at a desk is sitting
 *   in the chair drawn up to it.
 * - A body **attending** a piece does not touch it: it looks into a case, waits
 *   at a sink, stands in front of an altar. It wants to see the piece and to be
 *   walked past, so it stands a short step back.
 *
 * A body **sitting** is neither, and it is not at the centre of its seat: the
 * sitting clip holds it well behind its own root, so a root on the seat's
 * centre puts the back rest through the torso. `seatRoot` answers where the
 * root goes instead.
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
  'work-bench': AT_HAND,
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

/**
 * The seated body, measured off `Sitting_Idle_Loop` in `assets/dist/anims.glb`
 * skinned onto every one of the twelve dressed characters. Both are metres
 * behind the root the game puts on the anchor: the back is the furthest back of
 * the twelve, so the widest coat in the wardrobe still clears.
 */
const SEATED_BACK = 0.5
const SEATED_PELVIS = 0.33

/** Air between a body's back and the back rest it is against. */
const SEAT_CLEARANCE = 0.02

/**
 * How far forward of a seat's centre a body's root goes, along the way the seat
 * faces. Zero for a piece nobody sits on.
 *
 * A seat with a back puts the body's back against it: that is what a chair is
 * for, and it is the only placement where a torso and a back rest do not share
 * the same air. A seat without one centres the pelvis on the pad instead, which
 * is what perching on a stool looks like. Either way the pelvis has to land on
 * the pad, and the tests hold every seat to that.
 */
export function seatRoot(prop: FurnitureProp): number {
  const seat = seatSpecOf(prop)
  if (!seat) return 0
  if (seat.back !== undefined) return SEATED_BACK + SEAT_CLEARANCE - seat.back
  const [front, back] = seat.pad
  return SEATED_PELVIS - (front + back) / 2
}
