/** @gb/kitbash: buildings that look like buildings, from the Downtown kit. See CONTRACT.md. */
export { KitDressing } from './dressing.ts'
export { loadKit } from './kit/load.ts'
export { placeholderKit } from './kit/placeholder.ts'
export { KitLibrary, type KitPart } from './kit/library.ts'
export { KitIncomplete, KitUnmergeable } from './kit/error.ts'
export { KIT_MATERIALS, MODULE, nodeNamesOf, PIECE_IDS, PIECES, RELIEF, type Piece, type PieceId } from './catalog/pieces.ts'
export { RECIPES, type Course, type Recipe } from './catalog/recipes.ts'
