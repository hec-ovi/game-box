/** @gb/world: the city, its buildings, its people and their things. See CONTRACT.md. */
export { World, type WorldError, type PlotSpec } from './world.ts'
export { type CitySpec } from './model/city-spec.ts'
export { questView, type QuestView } from './quest-view.ts'
export { Grid, CELL, type CellKind, type Rect } from './grid.ts'
export { METRICS, cellCentre, type Metrics } from './metrics.ts'
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
export {
  BUILDING_KINDS,
  ROOM_KINDS,
  ANCHOR_KINDS,
  NPC_ROLES,
  ITEM_ARCHETYPES,
  FURNITURE_PROPS,
  BODY_KINDS,
  FACINGS,
  ROAD_KINDS,
  ENTERABLE_KINDS,
  type BuildingKind,
  type RoomKind,
  type AnchorKind,
  type NpcRole,
  type ItemArchetype,
  type FurnitureProp,
  type BodyKind,
  type Facing,
  type RoadKind,
} from './model/vocabulary.ts'
