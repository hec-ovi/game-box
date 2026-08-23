/** @gb/scribe: the narrator backed by the local model, one forced tool call per answer. See CONTRACT.md. */
export { Scribe, type ScribeOptions } from './scribe.ts'
export type { ScribeProblem } from './asker.ts'
export type {
  Instance,
  InstancePerson,
  InstancePost,
  InstanceRequest,
  InstanceStock,
  InstanceThing,
} from './instance.ts'
export type { PlaceRequest } from './place-names.ts'
export type { ProgressPort, ScribeProgress, ScribeStage } from './progress.ts'
