/** @gb/furnish: the inside of a building, generated from parameters. See CONTRACT.md. */
export { FurnishDressing } from './dressing.ts'
export { CELL, metresOf, type Cells, type Footprint } from './catalog/cells.ts'
export {
  PROP_SPECS,
  footprintOf,
  type Contact,
  type ContactKind,
  type PropSpec,
} from './catalog/specs.ts'
export { FurnishLibrary } from './kit/library.ts'
export { DEFAULT_SEED, furnishKit, loadFurnish } from './kit/load.ts'
export { type Built } from './kit/build.ts'
export { FURNISH_STYLES, PALETTES, type FurnishStyle, type Palette } from './style/palette.ts'
export { SOLID_MATERIAL } from './style/material.ts'
export { type Variant, variantOf } from './style/variant.ts'
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
