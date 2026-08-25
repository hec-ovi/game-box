/** @gb/sidecar: the client for the local AI sidecar. See CONTRACT.md. */
export { Sidecar, type SidecarOptions } from './client.ts'
export type { AskOptions, ConverseEvent, ConverseOptions, Sampling, ToolSpec } from './options.ts'
export type { SidecarError, TimeoutPhase } from './errors.ts'
export type { Timeouts } from './timeouts.ts'
export type { Backoff, BusyNotice } from './backoff.ts'
