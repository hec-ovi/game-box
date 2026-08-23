import { Rng } from '@gb/kit'
import { everyCorner, frontCorners, type Corners } from '../build/outline.ts'
import type { Edge } from '../build/profile.ts'
import { PALETTES, type FurnishStyle, type Palette } from './palette.ts'

/**
 * One prop kind's shape, drawn once from the seed.
 *
 * Nothing here can move a contact height: a variant decides the profile of an
 * edge, the radius on a corner, what holds the piece up, how a front divides
 * and whether a strip is lit. Height stays a contract and the footprint stays
 * the cells the planner claimed, so two variants of a table are the same table
 * to walk around and to sit at, and different to look at.
 *
 * Drawn from a stream forked per style and per prop, so adding a prop cannot
 * change how an existing one comes out.
 */
export type EdgeKind = 'sharp' | 'chamfer' | 'round'

/** What holds a piece off the floor. */
export type Support = 'post' | 'frame' | 'plinth' | 'panel'

export interface Variant {
  readonly style: FurnishStyle
  readonly palette: Palette
  readonly edge: EdgeKind
  /** Metres of radius on a rounded plan corner. */
  readonly radius: number
  /** Which plan corners take the radius. */
  readonly rounding: 'square' | 'front' | 'all'
  readonly support: Support
  /** Whether the piece carries a lit strip. */
  readonly trim: boolean
  /** How many panels, shelves or cushions a front divides into. */
  readonly divisions: number
  /** A proportion knob, 0 slim to 1 chunky. */
  readonly heft: number
}

interface Taste {
  readonly edges: readonly [EdgeKind, number][]
  readonly roundings: readonly ['square' | 'front' | 'all', number][]
  readonly supports: readonly [Support, number][]
  readonly radius: readonly [number, number]
  readonly trim: number
}

const TASTE: Record<FurnishStyle, Taste> = {
  // machined: square plan, a chamfer where an edge would cut, thin metal frames
  corpo: {
    edges: [
      ['sharp', 4],
      ['chamfer', 5],
      ['round', 1],
    ],
    roundings: [
      ['square', 5],
      ['front', 3],
      ['all', 1],
    ],
    supports: [
      ['frame', 5],
      ['post', 3],
      ['panel', 2],
      ['plinth', 1],
    ],
    radius: [0.01, 0.03],
    trim: 0.75,
  },
  // moulded: everything radiused, everything sitting on a plinth or a shell
  home: {
    edges: [
      ['sharp', 1],
      ['chamfer', 3],
      ['round', 6],
    ],
    roundings: [
      ['square', 1],
      ['front', 3],
      ['all', 6],
    ],
    supports: [
      ['plinth', 5],
      ['panel', 3],
      ['post', 2],
      ['frame', 1],
    ],
    radius: [0.03, 0.07],
    trim: 0.65,
  },
}

/** The look of one prop kind in one language. */
export function variantOf(style: FurnishStyle, prop: string, seed: string): Variant {
  const rng = new Rng(seed).fork('furnish').fork(style).fork(prop)
  const taste = TASTE[style]
  return {
    style,
    palette: PALETTES[style],
    edge: rng.weighted(taste.edges),
    radius: rng.range(taste.radius[0], taste.radius[1]),
    rounding: rng.weighted(taste.roundings),
    support: rng.weighted(taste.supports),
    trim: rng.chance(taste.trim),
    divisions: rng.int(2, 4),
    heft: rng.float(),
  }
}

/** The variant's edge treatment at a given size, ready for a block. */
export function edgeOf(variant: Variant, size: number): Edge {
  switch (variant.edge) {
    case 'sharp':
      return { kind: 'sharp' }
    case 'chamfer':
      return { kind: 'chamfer', size }
    case 'round':
      return { kind: 'round', size }
  }
}

/** The variant's plan corners at a given radius cap. */
export function cornersOf(variant: Variant, cap = Infinity): Corners {
  const radius = Math.min(variant.radius, cap)
  switch (variant.rounding) {
    case 'square':
      return everyCorner(0)
    case 'front':
      return frontCorners(radius)
    case 'all':
      return everyCorner(radius)
  }
}

/** Between two numbers, by how chunky this variant is. */
export function heft(variant: Variant, slim: number, chunky: number): number {
  return slim + (chunky - slim) * variant.heft
}
