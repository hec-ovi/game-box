/**
 * The source models this box builds furniture out of, and which way each one
 * faces in its own file.
 *
 * Both packs are Kenney's, drawn about half life size on a shared grid, so all
 * the catalog needs from a piece is its name and its front: the size and where
 * it sits are read off the geometry when the pack loads.
 *
 * `front` is measured, not assumed: `tools/measure.ts` reads the triangles and
 * `node game/furnish/tools/print-catalog.ts` prints the evidence. A test fails
 * if a piece stops agreeing with the catalog.
 */

/** `home` is Kenney's Furniture Kit, `shop` its Mini Market. */
export type Pack = 'home' | 'shop'

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
  // Kenney Furniture Kit
  bedSingle: { pack: 'home', front: '+z', note: 'headboard at the back, duvet turned down at the front' },
  bookcaseClosedDoors: { pack: 'home', front: '+z', note: 'a tall cupboard with doors: the wardrobe' },
  bookcaseClosedWide: { pack: 'home', front: '+z', note: 'a low wide cupboard: the sideboard' },
  bookcaseOpen: { pack: 'home', front: '+z', note: 'open shelving' },
  cardboardBoxClosed: { pack: 'home', front: '+z', note: 'a taped stock box; three of them make the stack' },
  chairDesk: { pack: 'home', front: '+z', note: 'a swivel chair on castors' },
  chairModernCushion: { pack: 'home', front: '+z' },
  desk: { pack: 'home', front: '+z' },
  kitchenBar: { pack: 'home', front: '+z', note: 'a counter with an overhang to sit at: the bar' },
  kitchenCabinet: { pack: 'home', front: '+z', note: 'a base unit with a worktop: the service counter' },
  kitchenCoffeeMachine: { pack: 'home', front: '+z' },
  kitchenFridgeLarge: { pack: 'home', front: '+z' },
  kitchenSink: { pack: 'home', front: '+z' },
  kitchenStove: { pack: 'home', front: '+z' },
  lampSquareFloor: { pack: 'home', front: '+z', note: 'a standing lamp' },
  loungeSofa: { pack: 'home', front: '+z' },
  pottedPlant: { pack: 'home', front: '+z' },
  rugRectangle: { pack: 'home', front: '+z' },
  speaker: { pack: 'home', front: '+z', note: 'a floor-standing speaker: the music in a bar' },
  stoolBar: { pack: 'home', front: '+z' },
  tableCoffeeSquare: { pack: 'home', front: '+z', note: 'a square cafe table' },
  televisionModern: { pack: 'home', front: '+z', note: 'a flat screen on a stand' },

  // Kenney Mini Market
  'cash-register': { pack: 'shop', front: '-z', note: 'the till' },
  'freezers-standing': { pack: 'shop', front: '+z', note: 'an upright chilled cabinet: the display case' },
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
