import { PROP_SPECS, footprintOf as metresOf, type Furniture, type FurnitureProp } from '@gb/world'
import { boxAt, gapToPiece, round, type Box, type Extent, type Vec } from './geometry.ts'

/**
 * A prop as the planner keeps it apart from everything else: its footprint in
 * metres and whether a body walks round it. Every number is read off
 * `@gb/world`'s `PROP_SPECS`, the one table the renderer builds to as well, so
 * a chair is never planned against a table drawn another size.
 */
export interface PropSpec extends Extent {
  /** Metres across the front of the piece. */
  readonly w: number
  /** Metres from its front to its back. */
  readonly d: number
  /** Whether a person has to walk around it. A rug does not stop anyone; a chair does. */
  readonly blocks: boolean
  /** A till and a coffee machine stand on a counter top; everything else stands on the floor. */
  readonly stands: 'floor' | 'counter'
}

const specs = new Map<FurnitureProp, PropSpec>()

export function specOf(prop: FurnitureProp): PropSpec {
  const held = specs.get(prop)
  if (held) return held
  const { width, depth } = metresOf(prop)
  const spec: PropSpec = { w: round(width), d: round(depth), blocks: PROP_SPECS[prop].blocks, stands: PROP_SPECS[prop].onSurface ? 'counter' : 'floor' }
  specs.set(prop, spec)
  return spec
}

/**
 * The part of a seat a body has to agree with: where its back stands, and how
 * far the surface you sit on runs from front to back. Both are metres from the
 * piece's own centre along its depth, positive towards its back, and both were
 * measured off the triangles `@gb/furnish` draws in both interior languages: a
 * back is the geometry that rises at least 0.2 m above the seat over the width
 * a torso covers, a pad is the level plate at the contact height.
 */
export interface SeatSpec {
  /** Front face of the back rest. A stool leaves it out: there is nothing to lean on. */
  readonly back?: number
  /** Front and back edge of the surface a body sits on. */
  readonly pad: readonly [number, number]
}

/**
 * Every piece a body sits or lies on, and nothing else. A bar stool is one of
 * them: `@gb/cast` sits a body on it at `stoolHeight` with its feet on the
 * rail, placed exactly like a chair anchor, and its pad is its whole top.
 */
export const SEAT_SPECS = {
  chair: { back: 0.194, pad: [-0.22, 0.22] },
  'office-chair': { back: 0.235, pad: [-0.232, 0.232] },
  sofa: { back: 0.37, pad: [-0.402, 0.242] },
  bed: { back: 0.95, pad: [-0.97, 0.867] },
  'bar-stool': { pad: [-0.2, 0.2] },
} as const satisfies Partial<Record<FurnitureProp, SeatSpec>>

export type SeatProp = keyof typeof SEAT_SPECS

/** What sitting on this piece means, or nothing for a piece nobody sits on. */
export function seatSpecOf(prop: FurnitureProp): SeatSpec | undefined {
  return (SEAT_SPECS as Partial<Record<FurnitureProp, SeatSpec>>)[prop]
}

/** The pieces something else stands on: a counter top a till or a coffee machine goes over. */
const HOSTS: readonly FurnitureProp[] = ['counter', 'bar-counter']

/** The height of a piece's top, or nothing for one nothing stands on. */
export function topOf(prop: FurnitureProp): number | undefined {
  if (!HOSTS.includes(prop)) return undefined
  const spec = PROP_SPECS[prop]
  return 'contact' in spec ? spec.contact.height : undefined
}

type Placement = Pick<Furniture, 'prop' | 'pos' | 'rot'>

/** The floor a placed piece covers. */
export function footprintOf(piece: Placement): Box {
  return boxAt(piece.pos, specOf(piece.prop), piece.rot)
}

/** Metres from a point to the nearest face of a placed piece; zero inside it. */
export function gapTo(piece: Placement, point: Vec): number {
  return gapToPiece(point, piece.pos, specOf(piece.prop), piece.rot)
}
