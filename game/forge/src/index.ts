/** @gb/forge: builds a city from a brief, then checks what it built. See CONTRACT.md. */
export { Forge, summarise, viewOf, type ForgeError, type ForgeResult } from './forge.ts'
export { briefContract, type Brief } from './brief.ts'
export { OfflineNarrator } from './offline-narrator.ts'
export type { Narrator, NpcProfile, ItemProfile, WorldSummary } from './narrator.ts'
export { gridSize, STREET_CELLS, SIDEWALK_CELLS, MOUNTAIN_CELLS } from './layout/streets.ts'
