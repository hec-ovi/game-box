/**
 * The subway entrance, in numbers. It is drawn from code on the kit's own
 * materials: a stairwell cut into the doorstep cell with a wall either side,
 * a lip round it, a back wall against the building and a lit box over that
 * spelling what the place is. Metres, origin at the middle of the cell on the
 * pavement, the mouth of the stairs opening onto +Z, which is the street.
 */
export const SUBWAY = {
  /** The stairwell: how wide at most and its share of a narrow cell, the wall either side, how far down it goes, and the air kept from the building and the kerb. */
  well: { widest: 1.5, share: 0.75, wall: 0.12, depth: 1.44, clear: 0.2 },
  /** How high the side walls stand over the pavement. */
  parapet: 0.95,
  /** How high the back wall stands, which is what the sign sits on. */
  back: 1.4,
  /** Each step down: its rise and its going. */
  step: { rise: 0.18, go: 0.2 },
  /** The lip round the well, proud of the pavement so the rain runs past it. */
  apron: 0.06,
  /** The lit box over the back wall: how tall the panel is, the housing round it, how deep, and the gap over the wall. */
  sign: { height: 0.42, housing: 0.08, depth: 0.12, over: 0.1 },
  /** What each part is made of, in the kit's own names: every one is in the shipped pack. */
  material: { wall: 'MI_Trim_MetalConcrete', step: 'MI_Trim', dark: 'MI_Asphalt' },
} as const

/** The opening of the well: across the cell and along it, inside the walls. */
export interface Well {
  readonly width: number
  readonly length: number
}

/** How big the well is on a cell of `cellSize` metres. */
export function wellOf(cellSize: number): Well {
  return { width: Math.min(SUBWAY.well.widest, cellSize * SUBWAY.well.share), length: cellSize - 2 * SUBWAY.well.clear }
}
