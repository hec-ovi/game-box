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
 * centre puts the back rest through the torso. A body **lying down** is the
 * simplest of the four: the lying clip is centred on its own root, so the root
 * goes on the middle of the mattress. `seatRoot` answers where the root goes in
 * either case.
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

/**
 * Propped against a wall, back to it, hands free, feet out in front. There is
 * no piece: the wall is the piece.
 *
 * The lean clips hold the body well behind its own root, so a root on the wall
 * puts the body through it. `LEAN_OUT` is where the root goes instead, measured
 * from the inside face: 0.414 m is the deepest any of the twelve dressed
 * characters reaches behind the root over the whole of any of the three
 * `Idle_Wall*` clips (the back of the widest coat), and this leaves 2.6 cm.
 * `@gb/cast` measures the same number in `tests/pose.test.ts`; this is our copy
 * of it, because a generator cannot import a renderer.
 */
export const LEAN_OUT = 0.44

/** The floor a propped body takes: across the wall, and out from it. */
export const LEAN_BODY = { w: 0.76, d: 0.79 }

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
 * Anchor kinds where the body lies down rather than sits up. A lying clip has
 * no back to press against anything and no pelvis behind its root: it is
 * centred, and `@gb/cast` measures it reaching 0.96 m either way.
 */
const LYING: readonly AnchorKind[] = ['sleep']

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
 * A body lying down is centred on its own root, so the root goes on the middle
 * of the pad and nothing else about the piece matters: a headboard is behind
 * the head, not against the back. A seat with a back puts the body's back
 * against it: that is what a chair is for, and it is the only placement where a
 * torso and a back rest do not share the same air. A seat without one centres
 * the pelvis on the pad instead, which is what perching on a stool looks like.
 * The tests hold every seat to landing its body on its own pad.
 */
export function seatRoot(prop: FurnitureProp, kind: AnchorKind): number {
  const seat = seatSpecOf(prop)
  if (!seat) return 0
  const [front, back] = seat.pad
  const middle = (front + back) / 2
  if (LYING.includes(kind)) return -middle
  if (seat.back !== undefined) return SEATED_BACK + SEAT_CLEARANCE - seat.back
  return SEATED_PELVIS - middle
}
