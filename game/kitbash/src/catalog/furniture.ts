/**
 * Kit pieces that stand on the street instead of sitting in a wall. They are
 * not `PIECES`: none of them is a module, so none of the wall-plane rules in
 * compose/ apply to them. They are placed whole, upright, on the pavement.
 *
 * Bounds are metres in the piece's own frame, base on y = 0, centred on x and
 * z, and they are what tools/street-furniture.ts writes into the pack.
 */
export interface FurniturePiece {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
  /** Material names, in the pack's own naming. */
  readonly materials: readonly string[]
}

/** The post and arm. Never lights up. */
export const LAMP_POST = 'MI_Lamp_Post'

/** The lantern: the one surface that glows once it is dark. */
export const LAMP_LENS = 'MI_Lamp_Lens'

export const FURNITURE = {
  Streetlight_Single: {
    min: [-0.263, 0, -0.263],
    max: [0.263, 4.361, 0.263],
    materials: [LAMP_POST, LAMP_LENS],
  },
} as const satisfies Record<string, FurniturePiece>

export type FurnitureId = keyof typeof FURNITURE

export const FURNITURE_IDS = Object.keys(FURNITURE) as FurnitureId[]

/** The piece a street lamp is made of. */
export const LAMP: FurnitureId = 'Streetlight_Single'
