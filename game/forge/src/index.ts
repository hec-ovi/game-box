/** @gb/forge: builds a city from a brief, then checks what it built. See CONTRACT.md. */
export { Forge, summarise, type ForgeError, type ForgeResult } from './forge.ts'
export { briefContract, type Brief } from './brief.ts'
export { OfflineNarrator } from './offline-narrator.ts'
export type {
  Instance,
  InstancePerson,
  InstancePost,
  InstanceRequest,
  InstanceStock,
  InstanceThing,
  ItemProfile,
  Narrator,
  NpcProfile,
  WorldSummary,
} from './narrator.ts'
export { BANDS, MOUNTAIN_CELLS, RoadBand, type BandKind } from './layout/bands.ts'
