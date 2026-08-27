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

/** Which work a call is. The service routes it to whichever provider that job is assigned to. */
export type Job = 'history' | 'city' | 'places' | 'quests' | 'dialogs'

/** What the call is for. A caller that names one is routed on it; one that names none goes where everything goes. */
export interface Routed {
  readonly job?: Job | undefined
}

/** What pins the engine's draw. Both go out exactly when given; nothing is invented for a call that names neither. */
export interface Sampling {
  readonly temperature?: number | undefined
  /** 0 to 4294967294, the sidecar's range. */
  readonly seed?: number | undefined
}

export interface AskOptions extends Cancellable, Routed, Sampling {
  readonly system: string
  readonly user: string
  /** The tool the model must call. Its schema is both the contract and the constraint. */
  readonly toolName: string
  readonly toolDescription: string
  /** Whole call, request start to the last byte. Defaults to this `Sidecar`'s `askMs`. */
  readonly timeoutMs?: number | undefined
}

export interface ConverseOptions extends Cancellable, Routed, Sampling {
  readonly system: string
  readonly messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
  /** What the speaker is allowed to do right now. Only these can be called. */
  readonly tools?: readonly ToolSpec[]
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
