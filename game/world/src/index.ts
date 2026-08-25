/** @gb/world: the city, its buildings, its people and their things. See CONTRACT.md. */
export { World, type WorldError, type PlotSpec } from './world.ts'
export { type CitySpec } from './model/city-spec.ts'
export { questView, type QuestView } from './quest-view.ts'
export { Grid, CELL, CELL_KINDS, type CellKind, type Rect } from './grid.ts'
export { METRICS, cellCentre, type Metrics } from './metrics.ts'
export {
  PROP_SPECS,
  PROP_CELL,
  footprintOf,
  type PropSpec,
  type PropCells,
  type PropContact,
  type PropContactKind,
  type PropFootprint,
} from './props.ts'
export { PLOT_BAND, plotShape, inPlotBand, type CellRange, type PlotShape } from './plot-band.ts'
export { ROAD_WIDTHS, WIDEST_ROADWAY_CELLS, type RoadWidth } from './roads.ts'
export { checkIntegrity, type IntegrityProblem } from './integrity.ts'
export {
  worldContract,
  type WorldDoc,
  type Plot,
  type Interior,
  type Room,
  type Door,
  type Anchor,
  type Furniture,
  type Npc,
  type Item,
  type Placement,
  type RoadNode,
  type RoadSegment,
} from './model/schema.ts'
export { MAX_CATALOGUES, type AssetPackRef, type PlotDesign } from './model/design.ts'
export { PremiseSchema, premiseContract, type Premise } from './model/premise.ts'
export { WORD, WordSchema, type Word } from './model/word.ts'
export {
  CharterSchema,
  charterContract,
  MOST_NAMES,
  MOST_RUMOURS,
  MOST_SERVICES,
  type Charter,
  type CharterRoom,
  type CharterService,
} from './model/charter.ts'
export {
  ResolvedCharterSchema,
  ChartersSchema,
  resolvedCharterContract,
  chartersContract,
  MAX_CHARTERS,
  type ResolvedCharter,
  type Built,
  type Course,
  type Signage,
} from './model/resolved.ts'
export {
  ROOM_USES,
  FRONTAGES,
  OPENNESS,
  MATERIALS,
  SIGN_VOICES,
  ACCESS_KINDS,
  SERVICES,
  WORK_KINDS,
  HOLDINGS,
  FINISHES,
  PROMINENCES,
  SPRAWLS,
  type RoomUse,
  type Frontage,
  type Openness,
  type Material,
  type SignVoice,
  type AccessKind,
  type Service,
  type WorkKind,
  type Holding,
  type Finish,
  type Prominence,
  type Sprawl,
} from './model/traits.ts'
export { KIT_PIECES, type KitPiece } from './model/pieces.ts'
export { SHIPPED_CHARTERS, BUILDING_KINDS, type BuildingKind } from './charters/presets/index.ts'
export { HOLDING_ARCHETYPES } from './charters/holdings.ts'
export { ROOM_USE_KIND, roomKindOf, roomUseOf } from './charters/room-use.ts'
export {
  AsksSchema,
  StyleSchema,
  NEON_LEVELS,
  DENSITY_LEVELS,
  WEAR_LEVELS,
  type Asks,
  type Style,
  type NeonLevel,
  type DensityLevel,
  type WearLevel,
} from './model/asks.ts'
export {
  LifeSchema,
  BackgroundFactSchema,
  BACKGROUND_UNLOCKS,
  MAX_BACKGROUND_FACTS,
  type Life,
  type BackgroundFact,
  type BackgroundUnlock,
} from './model/life.ts'
export {
  ROOM_KINDS,
  ANCHOR_KINDS,
  NPC_ROLES,
  ITEM_ARCHETYPES,
  FURNITURE_PROPS,
  BODY_KINDS,
  FACINGS,
  ROAD_KINDS,
  type RoomKind,
  type AnchorKind,
  type NpcRole,
  type ItemArchetype,
  type FurnitureProp,
  type BodyKind,
  type Facing,
  type RoadKind,
} from './model/vocabulary.ts'
