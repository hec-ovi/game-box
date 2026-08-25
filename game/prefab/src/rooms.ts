/**
 * The rooms a window looks into: fourteen pictures, committed as art, stacked
 * into one array texture beside the pack's two others.
 *
 * A room is seen small, through glass, at an angle, after dark, and never twice
 * side by side, so a dozen is enough for a city. Two banks, because a bay on
 * the third floor and a shop window on the pavement are not the same room: the
 * upper bank is what people live and work in, the street bank is what they walk
 * into.
 */

/** Pixels a side, per room. A shop window is two metres of it at arm's length, so this is the floor. */
export const ROOM_SIZE = 256

/** The order the rooms sit in the array texture. A bank is a run of it. */
export const ROOM_PICTURES: readonly string[] = [
  'office-desks',
  'office-partition',
  'server-racks',
  'flat-living',
  'flat-kitchen',
  'flat-bedroom',
  'corridor',
  'store-room',
  'bar-bottles',
  'noodle-counter',
  'shop-racks',
  'clinic-cabinets',
  'workshop-tools',
  'lobby-desk',
]

/** Which run of the strip a kind of window draws from: the first layer and how many. */
export interface Bank {
  readonly first: number
  readonly count: number
}

/**
 * What burns in a room: the colours a lit window is tinted in, near and far.
 * Five of the eight are warm, because a street of lit windows after dark is
 * mostly tungsten and only some of it is the strip light in an office; the
 * saturated three are the accents `docs/LOOK.md` asks for.
 */
export const ROOM_TINTS: ReadonlyArray<readonly [number, number, number]> = [
  [1.0, 0.87, 0.68],
  [1.0, 0.74, 0.45],
  [1.0, 0.9, 0.78],
  [1.0, 0.8, 0.55],
  [0.94, 0.96, 1.0],
  [0.62, 0.9, 1.0],
  [0.72, 1.0, 0.9],
  [1.0, 0.7, 0.87],
]

export const ROOM_BANKS = {
  /** Above the street: offices, a server room, flats, a corridor, a store room. */
  upper: { first: 0, count: 8 },
  /** On the pavement: a bar, a noodle counter, a shop, a clinic, a workshop, a lobby. */
  street: { first: 8, count: 6 },
} as const satisfies Record<string, Bank>
