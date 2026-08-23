/** @gb/sidecar: the client for the local AI sidecar. See CONTRACT.md. */
export { Sidecar, type SidecarOptions } from './client.ts'
export type { AskOptions, ConverseEvent, ConverseOptions, ToolSpec } from './options.ts'
export type { SidecarError, TimeoutPhase } from './errors.ts'
export type { Timeouts } from './timeouts.ts'
