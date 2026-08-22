import type { ToolCallEvent } from './schema.ts'

interface CallDelta {
  readonly id?: unknown
  readonly function?: { readonly name?: unknown; readonly arguments?: unknown }
}

/**
 * A tool call being assembled from stream deltas. It becomes an event only
 * once it is named and its arguments parse as a JSON object, so a half-built
 * call never crosses the boundary.
 */
export class PendingCall {
  #id: string | undefined
  #name = ''
  #arguments = ''

  absorb(delta: unknown): void {
    const part = (delta ?? {}) as CallDelta
    if (typeof part.id === 'string') this.#id = part.id
    if (typeof part.function?.name === 'string') this.#name += part.function.name
    if (typeof part.function?.arguments === 'string') this.#arguments += part.function.arguments
  }

  finish(): ToolCallEvent | undefined {
    if (this.#name === '') return undefined
    const text = this.#arguments.trim() === '' ? '{}' : this.#arguments.trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return undefined
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const event: ToolCallEvent = { type: 'tool-call', name: this.#name, arguments: parsed as Record<string, unknown> }
    return this.#id === undefined ? event : { ...event, id: this.#id }
  }
}
