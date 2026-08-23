/** What can be lying on a street. */
export type ClutterKind = 'bin' | 'skip' | 'crate' | 'pallet' | 'bag' | 'cable' | 'scrap' | 'can'

/** Where a kind is allowed to end up. */
export type ClutterBand = 'wall' | 'kerb' | 'litter'

export interface ClutterSpec {
  /** Across the front, through it, and up, in metres, before any scaling. */
  readonly width: number
  readonly depth: number
  readonly height: number
  /** How many colourways are generated for it, so a street is not one repeated object. */
  readonly variants: number
}

/**
 * Every piece of rubbish on the street, at a real size.
 *
 * Nothing standing is deeper than `BAND.wall`, because the pavement `@gb/forge`
 * lays is one 2 m cell wide and the middle of it has to stay walkable. What is
 * bigger than that in a real street (a skip) is long rather than deep: it sits
 * along the wall, not out into the pavement.
 */
export const CLUTTER: Record<ClutterKind, ClutterSpec> = {
  bin: { width: 0.62, depth: 0.48, height: 1.05, variants: 3 },
  skip: { width: 1.5, depth: 0.5, height: 0.92, variants: 2 },
  crate: { width: 0.5, depth: 0.44, height: 0.38, variants: 3 },
  pallet: { width: 1.05, depth: 0.3, height: 1.1, variants: 2 },
  bag: { width: 0.46, depth: 0.42, height: 0.46, variants: 3 },
  cable: { width: 0.44, depth: 0.44, height: 0.09, variants: 2 },
  scrap: { width: 0.26, depth: 0.2, height: 0.012, variants: 4 },
  can: { width: 0.13, depth: 0.08, height: 0.08, variants: 3 },
}

/** What each band will take, and how often, out of the kinds that fit it. */
const BAND_WEIGHTS: Record<ClutterBand, ReadonlyArray<readonly [ClutterKind, number]>> = {
  wall: [
    ['bag', 5],
    ['bin', 4],
    ['crate', 4],
    ['pallet', 2],
    ['skip', 1],
  ],
  kerb: [
    ['bag', 6],
    ['crate', 2],
    ['cable', 2],
  ],
  litter: [
    ['scrap', 8],
    ['can', 1],
  ],
}

/** The same weights as a flat list, so drawing one is a plain pick off a seeded stream. */
export const BAND_PICKS: Record<ClutterBand, readonly ClutterKind[]> = {
  wall: spread(BAND_WEIGHTS.wall),
  kerb: spread(BAND_WEIGHTS.kerb),
  litter: spread(BAND_WEIGHTS.litter),
}

function spread(weights: ReadonlyArray<readonly [ClutterKind, number]>): ClutterKind[] {
  return weights.flatMap(([kind, weight]) => Array<ClutterKind>(weight).fill(kind))
}

/** Every colourway of every kind, as something to pick out of. */
export const VARIANTS: Record<ClutterKind, readonly number[]> = mapKinds((kind) => [
  ...Array(CLUTTER[kind].variants).keys(),
])

function mapKinds<T>(of: (kind: ClutterKind) => T): Record<ClutterKind, T> {
  const out = {} as Record<ClutterKind, T>
  for (const kind of Object.keys(CLUTTER) as ClutterKind[]) out[kind] = of(kind)
  return out
}

/**
 * How the 2 m pavement is divided across its width, in metres. The middle is
 * never claimed by anything: it is what the player and the crowd walk down, and
 * it is wider than the 0.7 m a body needs to pass.
 */
export const BAND = {
  /** Against the building line, where refuse is put out. */
  wall: 0.5,
  /** The walking lane, left empty by construction. It is wider than the 0.7 m a body needs. */
  walkway: 0.94,
  /** The gutter side, where bags and cabling end up. */
  kerb: 0.46,
} as const

/** Anything standing taller than this would stop the player, so nothing on the street does. */
export const CLUTTER_MAX_HEIGHT = 1.2

/** How much room the street leaves round the things people have to reach and drive on, in metres. */
export const CLEARANCE = {
  /** Round a doorstep, so a doorway is never blocked. */
  doorstep: 1.6,
  /** Either side of the double yellow down the middle of a road. */
  centreLine: 0.75,
  /** Round a crossing and the bar cars stop at. */
  crossing: 0.35,
  /** Off the kerb edge and the building line, so nothing hangs over either. */
  edge: 0.05,
} as const
