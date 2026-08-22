/**
 * The source models this box builds furniture out of, and which way each one
 * faces in its own file.
 *
 * Both KayKit packs are authored about twice life size, and a wall shelf or a
 * picture frame is drawn around its own centre rather than standing on the
 * floor, so all the catalog needs from a piece is its name and its front: the
 * size and where it sits are read off the geometry when the pack loads.
 *
 * `front` is measured, not assumed: `tools/measure.ts` reads the triangles and
 * `node game/furnish/tools/print-catalog.ts` prints the evidence. Both packs
 * came back the same way, front on +z, and a test fails if a piece stops
 * agreeing with the catalog.
 */
export type Pack = 'furniture' | 'dungeon'

/** A horizontal face of a piece, the way `tools/measure.ts` names them. */
export type Face = '+x' | '-x' | '+z' | '-z'

export interface Piece {
  readonly pack: Pack
  /** The face a person is meant to stand at. */
  readonly front: Face
  /** What the model is, where the name does not say it. */
  readonly note?: string
}

export const PIECES = {
  // KayKit Furniture Bits
  bed_single_A: { pack: 'furniture', front: '+z', note: 'headboard at the back, foot at the front' },
  cabinet_medium: { pack: 'furniture', front: '+z', note: 'a two-door sideboard: the bar and shop counters' },
  cabinet_small: { pack: 'furniture', front: '+z' },
  cabinet_small_decorated: { pack: 'furniture', front: '+z', note: 'a carved cabinet with clutter on top' },
  cactus_medium_A: { pack: 'furniture', front: '+z', note: 'a potted plant' },
  chair_A_wood: { pack: 'furniture', front: '+z' },
  chair_B: { pack: 'furniture', front: '+z' },
  chair_stool_wood: { pack: 'furniture', front: '+z' },
  couch: { pack: 'furniture', front: '+z' },
  lamp_standing: { pack: 'furniture', front: '+z' },
  pictureframe_small_B: { pack: 'furniture', front: '+z', note: 'a framed panel' },
  rug_rectangle_A: { pack: 'furniture', front: '+z' },
  shelf_B_small: { pack: 'furniture', front: '+z', note: 'one shelf board on brackets; three of them make the shelving' },
  shelf_B_small_decorated: { pack: 'furniture', front: '+z', note: 'a shelf with pots on it' },
  table_small: { pack: 'furniture', front: '+z' },

  // KayKit Dungeon Pack
  barrel_small: { pack: 'dungeon', front: '+z' },
  chest: { pack: 'dungeon', front: '+z', note: 'lock and hinges on the front' },
  crates_stacked: { pack: 'dungeon', front: '+z' },
  floor_foundation_allsides: { pack: 'dungeon', front: '+z', note: 'a dressed stone block' },
  keg: { pack: 'dungeon', front: '+z' },
} as const satisfies Record<string, Piece>

export type PieceId = keyof typeof PIECES

export const PIECE_IDS = Object.keys(PIECES) as PieceId[]

/** How far to turn a piece so its front looks north, which is where @gb/scene points a prop at rotation zero. */
export function yawOf(front: Face): number {
  switch (front) {
    case '-z':
      return 0
    case '+z':
      return Math.PI
    case '+x':
      return Math.PI / 2
    case '-x':
      return -Math.PI / 2
  }
}
