/**
 * The pieces of the Downtown City MegaKit this box builds with, measured from
 * the kit's own glTF files by tools/measure.mjs. Bounds are metres in the
 * piece's own frame.
 *
 * A wall piece is authored with its outer face on z = 0, its body running back
 * into negative z, its width centred on x and its base on y = 0. Every rule in
 * build/ depends on that, so a piece that breaks it does not belong here. The
 * few millimetres some pieces reach past z = 0 are window and trim relief, and
 * they are why a finished building is a little larger than its plot.
 */
export interface Piece {
  readonly min: readonly [number, number, number]
  readonly max: readonly [number, number, number]
  /** Material names, in the kit's own naming. */
  readonly materials: readonly string[]
  /** The node inside the file, when the kit does not name it after the file. */
  readonly node?: string
}

export const PIECES = {
  // street level, one module wide, 3 m tall
  Brick_BottomTrim: { min: [-1, 0, -0.2], max: [1, 3, 0.029], materials: ['MI_RedBrick', 'MI_Trim', 'MI_InteriorWall'] },
  Brick_Window_Trim: { min: [-1, 0, -0.257], max: [1, 3, 0.047], materials: ['MI_RedBrick', 'MI_Trim', 'MI_Glass', 'MI_FakeInterior', 'MI_InteriorWall'] },
  Metal_FirstFloor_Wall: { min: [-1, 0, -0.2], max: [1, 3, 0.042], materials: ['MI_Trim_Dark', 'MI_Trim_MetalConcrete', 'MI_InteriorWall'] },
  Metal_FirstFloor_Window: { min: [-1, 0, -0.217], max: [1, 3, 0.042], materials: ['MI_Trim_Dark', 'MI_Trim_MetalConcrete', 'MI_Glass', 'MI_FakeInterior', 'MI_InteriorWall'] },
  Trim_FirstFloor_Wall: { min: [-1, 0, -0.2], max: [1, 3, 0.048], materials: ['MI_Trim', 'MI_InteriorWall'] },
  Trim_FirstFloor_Window_001: { min: [-1, -0.01, -0.215], max: [1, 3, 0], materials: ['MI_Trim_Green', 'MI_FakeInterior', 'MI_InteriorWall', 'MI_Glass'], node: 'Trim_FirstFloor_Window.001' },
  Metal_FullWindow: { min: [-1, 0, -0.216], max: [1, 3, 0.015], materials: ['MI_Trim_MetalConcrete', 'MI_Glass', 'MI_FakeInterior'] },

  // doors: a whole module with the opening already filled
  DoorFrame_Trim: { min: [-1, 0, -0.226], max: [1, 3, 0], materials: ['MI_Trim_Green', 'MI_Glass', 'MI_Trim', 'MI_InteriorWall'] },
  DoorFrame_Metal_Single: { min: [-1, 0, -0.2], max: [1, 3, 0], materials: ['MI_Trim_MetalConcrete', 'MI_Glass'] },

  // the metre-tall band that closes a 4 m ground floor over a 3 m module
  Brick_Plain_1: { min: [-1, 0, -0.2], max: [1, 1, 0], materials: ['MI_RedBrick', 'MI_InteriorWall'] },
  Metal_Plain_1: { min: [-1, 0, -0.2], max: [1, 1, 0], materials: ['MI_Trim_MetalConcrete', 'MI_InteriorWall'] },
  Metal_FirstFloor_Wall_1: { min: [-1, 0, -0.2], max: [1, 1, 0.042], materials: ['MI_Trim_Dark', 'MI_InteriorWall'] },

  // upper storeys
  Brick_Plain_3: { min: [-1, 0, -0.2], max: [1, 3, 0], materials: ['MI_RedBrick', 'MI_InteriorWall'] },
  Brick_Window_Square_Single: { min: [-1, 0, -0.235], max: [1, 3, 0.036], materials: ['MI_RedBrick_Pale', 'MI_Trim', 'MI_Glass', 'MI_FakeInterior', 'MI_InteriorWall'] },
  Brick_Window_Trim_Single: { min: [-1, 0, -0.232], max: [1, 3, 0.044], materials: ['MI_RedBrick', 'MI_Trim', 'MI_Glass', 'MI_FakeInterior', 'MI_InteriorWall'] },
  Metal_Plain_3: { min: [-1, 0, -0.2], max: [1, 3, 0], materials: ['MI_Trim_MetalConcrete', 'MI_InteriorWall'] },
  Metal_Window_Half: { min: [-1, 0, -0.213], max: [1, 3, 0.015], materials: ['MI_Trim_MetalConcrete', 'MI_Glass', 'MI_FakeInterior'] },

  /** The same wall as Brick_Plain_3 with the crowning course on it. */
  Brick_TopTrim: { min: [-1, 0, -0.2], max: [1, 3, 0], materials: ['MI_RedBrick_Pale', 'MI_Trim', 'MI_InteriorWall'] },

  /** Flat deck: one quad 0.2 m under its origin, so the wall top above it reads as a parapet. */
  Roof_2x2: { min: [-1, -0.2, -1], max: [1, -0.2, 1], materials: ['MI_Asphalt'] },
} as const satisfies Record<string, Piece>

export type PieceId = keyof typeof PIECES

export const PIECE_IDS = Object.keys(PIECES) as PieceId[]

/**
 * Every material name in the kit's own files: the draw-call ceiling for one
 * merged building. The pack folds names sharing a texture set together, so a
 * building out of `assets/dist/downtown-kit.glb` draws with fewer than these.
 */
export const KIT_MATERIALS: readonly string[] = [...new Set(PIECE_IDS.flatMap((id) => PIECES[id].materials))].sort()

/**
 * How far a wall piece is allowed to stand proud of the wall plane, and so how
 * far a finished building can reach past its plot on each face. A test holds
 * every piece in the catalog to it.
 */
export const RELIEF = 0.05

/** The module everything is laid out on: 2 m of wall across, 3 m of wall up, and a 1 m band to close a floor. */
export const MODULE = { width: 2, height: 3, band: 1 } as const

/**
 * What the piece is called once it is in a scene graph. three.js strips the
 * characters an animation path would choke on, so a Blender name like
 * `Trim_FirstFloor_Window.001` arrives without its dot.
 */
export function nodeNamesOf(id: PieceId): string[] {
  const piece: Piece = PIECES[id]
  const authored = piece.node ?? id
  return [...new Set([authored, authored.replace(/[[\].:/]/g, ''), id])]
}
