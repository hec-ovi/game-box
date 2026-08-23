import type { SidecarError } from './errors.ts'

export interface ToolSpec {
  readonly name: string
  readonly description: string
  /** JSON Schema for the arguments. Comes from the contract that also checks them. */
  readonly parameters: Record<string, unknown>
}

/** Every call takes the caller's own signal. Aborting is the caller's decision, never a failure to retry. */
interface Cancellable {
  readonly signal?: AbortSignal | undefined
}

export interface AskOptions extends Cancellable {
  readonly system: string
  readonly user: string
  /** The tool the model must call. Its schema is both the contract and the constraint. */
  readonly toolName: string
  readonly toolDescription: string
  readonly temperature?: number
  /** Whole call, request start to the last byte. Defaults to this `Sidecar`'s `askMs`. */
  readonly timeoutMs?: number | undefined
}

export interface ConverseOptions extends Cancellable {
  readonly system: string
  readonly messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
  /** What the speaker is allowed to do right now. Only these can be called. */
  readonly tools?: readonly ToolSpec[]
  readonly temperature?: number
  /** Request start to the first byte of the reply. Defaults to this `Sidecar`'s `firstTokenMs`. */
  readonly firstTokenMs?: number | undefined
  /** Longest allowed gap between two pieces of the reply. Defaults to this `Sidecar`'s `idleMs`. */
  readonly idleMs?: number | undefined
}

export type ConverseEvent =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'call'; readonly name: string; readonly arguments: unknown }
  | { readonly kind: 'end'; readonly reason: string }
  /** The stream broke off. Terminal: nothing follows it. */
  | { readonly kind: 'error'; readonly error: SidecarError }
