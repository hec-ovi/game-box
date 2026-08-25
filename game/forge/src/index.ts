/** @gb/forge: builds a city from a brief, then checks what it built. See CONTRACT.md. */
export { Forge, summarise, type ForgeError, type ForgeResult, type Growth, type GrownQuests } from './forge.ts'
export { briefContract, type Brief } from './brief.ts'
export { OfflineNarrator } from './offline-narrator.ts'
export { premiseLines } from './premise/render.ts'
export { questTargets } from './quests/targets.ts'
/** The history's own shape is `@gb/world`'s. Passed through here while `@gb/scribe` still reads it off this box. */
export { premiseContract, type Premise } from '@gb/world'
/** What a narrator writes as a history: the premise, and the kinds of place it declares. */
export { historyContract, HistorySchema, type History } from './premise/shape.ts'
export type { Dropped } from './charters/resolve.ts'
export type {
  Instance,
  InstanceBrief,
  InstancePerson,
  InstancePost,
  InstanceRequest,
  InstanceStock,
  InstanceThing,
  ItemProfile,
  Narrator,
  NpcProfile,
  PlaceRequest,
  SummaryLock,
  SummaryMachine,
  WorldSummary,
} from './narrator.ts'
export { BANDS, MOUNTAIN_CELLS, RoadBand, type BandKind } from './layout/bands.ts'
