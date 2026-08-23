/** @gb/furnish: the inside of a building, generated from parameters. See CONTRACT.md. */
export { FurnishDressing } from './dressing.ts'
export { FurnishRoom } from './room.ts'
export { CELL, metresOf, type Cells, type Footprint } from './catalog/cells.ts'
export {
  PROP_SPECS,
  footprintOf,
  type Contact,
  type ContactKind,
  type PropSpec,
} from './catalog/specs.ts'
export { ITEM_SPECS, type ItemSpec } from './items/specs.ts'
export { ITEM_CASTS, castIndex, itemCast, type ItemCast } from './items/cast.ts'
export { MATTER, type Matter } from './items/matter.ts'
export { FurnishLibrary } from './kit/library.ts'
export { DEFAULT_SEED, furnishKit, loadFurnish } from './kit/load.ts'
export { type Built } from './kit/build.ts'
export { FURNISH_STYLES, PALETTES, type FurnishStyle, type Palette } from './style/palette.ts'
export { SCREEN_ATTRIBUTE, SOLID_MATERIAL } from './style/material.ts'
export {
  CYCLE,
  PROGRAMMES,
  SPOT,
  SPOTS,
  STATIONS,
  SWITCH,
  programmeAt,
  spotAt,
  type Spot,
} from './screens/schedule.ts'
export { SCREEN_SLOTS, screenSlot, screeningOf, type Screening } from './screens/screening.ts'
export { SCREEN_LIGHT, pictureAt, type Rgb } from './screens/picture.ts'
export { screenAverage } from './screens/light.ts'
export { type Variant, variantOf } from './style/variant.ts'
export {
  BAY_SPECS,
  BAY_TASTE,
  WALL,
  WALL_CONTACTS,
  type BayKind,
  type BaySpec,
} from './walls/bays.ts'
export { type PlacedBay } from './walls/build.ts'
export { SIDES, type Side } from './walls/runs.ts'
export { SurfaceLibrary, mapsOf, type SurfaceMaps } from './surfaces/library.ts'
export { surfaceChoices, type SurfaceChoices } from './surfaces/choose.ts'
export { type Pattern, type PatternKind } from './surfaces/pattern.ts'
export { MetreTiling, tilingOf } from './surfaces/tiling.ts'
export {
  SURFACE_LOOKS,
  SURFACE_PARTS,
  SURFACE_TEXTURES,
  SURFACE_TEXTURE_IDS,
  lookOf,
  type SurfaceLook,
  type SurfacePart,
  type SurfaceTexture,
  type SurfaceTextureId,
} from './surfaces/surfaces.ts'
