/** @gb/scribe: the narrator backed by the local model, one forced tool call per answer. See CONTRACT.md. */
export { Scribe, type ScribeOptions } from './scribe.ts'
export type { ScribeProblem } from './asker.ts'
export type { Asked } from './asked.ts'
export type { PremiseInput } from './premise.ts'
export type { QuestInput } from './quests.ts'
export type { QuestSummary } from './summary.ts'
export type { PlaceRequest } from './signs.ts'
export type { ProgressPort, ScribeProgress, ScribeStage } from './progress.ts'
