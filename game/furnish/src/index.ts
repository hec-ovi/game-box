/** @gb/furnish: the inside of a building, in real art. See CONTRACT.md. */
export { FurnishDressing } from './dressing.ts'
export { PIECES, PIECE_IDS, yawOf, type Face, type Pack, type Piece, type PieceId } from './catalog/pieces.ts'
export { PROP_ART, piecesUsed, type Contact, type ContactKind, type PropArt, type PropPart } from './catalog/props.ts'
export { FurnishIncomplete } from './kit/error.ts'
export { FurnishLibrary } from './kit/library.ts'
export { loadFurnish } from './kit/load.ts'
export { placeholderFurnish } from './kit/placeholder.ts'
export { type Built, type Part } from './kit/build.ts'
export { SurfaceLibrary, type SurfaceMaps } from './surfaces/library.ts'
export { MetreTiling, tilingOf } from './surfaces/tiling.ts'
export {
  SURFACE_LOOKS,
  SURFACE_PARTS,
  SURFACE_TEXTURES,
  SURFACE_TEXTURE_IDS,
  type SurfaceLook,
  type SurfacePart,
  type SurfaceTexture,
  type SurfaceTextureId,
} from './surfaces/surfaces.ts'
