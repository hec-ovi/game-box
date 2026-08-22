import { err, ok, type Contract, type Result } from '@gb/kit'
import type { SidecarError } from './errors.ts'
import { sseData } from './sse.ts'

export interface ToolSpec {
  readonly name: string
  readonly description: string
  /** JSON Schema for the arguments. Comes from the contract that also checks them. */
  readonly parameters: Record<string, unknown>
}

export interface AskOptions {
  readonly system: string
  readonly user: string
  /** The tool the model must call. Its schema is both the contract and the constraint. */
  readonly toolName: string
  readonly toolDescription: string
  readonly temperature?: number
}

export interface ConverseOptions {
  readonly system: string
  readonly messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
  /** What the speaker is allowed to do right now. Only these can be called. */
  readonly tools?: readonly ToolSpec[]
  readonly temperature?: number
}

export type ConverseEvent =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'call'; readonly name: string; readonly arguments: unknown }
  | { readonly kind: 'end'; readonly reason: string }

const DEFAULT_BASE = 'http://127.0.0.1:8976'

/**
 * The client for the local AI sidecar. `ask` gets one structured answer: the
 * model is handed a single tool and told to call it, so what comes back is a
 * typed value checked against the very schema the tool was built from, never
 * prose. `converse` streams a reply as it is spoken, with any actions the
 * speaker takes arriving as calls in the same stream.
 */
export class Sidecar {
  #base: string
  #model: string
  #fetch: typeof fetch

  constructor(options: { base?: string; model?: string; fetch?: typeof fetch } = {}) {
    this.#base = (options.base ?? readEnv('GAME_BOX_URL') ?? DEFAULT_BASE).replace(/\/$/, '')
    this.#model = options.model ?? 'game-box/local'
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  get base(): string {
    return this.#base
  }

  async ask<T>(contract: Contract<T>, options: AskOptions): Promise<Result<T, SidecarError>> {
    const response = await this.#post({
      model: this.#model,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      tools: [
        {
          type: 'function',
          function: {
            name: options.toolName,
            description: options.toolDescription,
            parameters: contract.jsonSchema(),
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: options.toolName } },
    })
    if (!response.ok) return response

    const payload = (await response.value.json().catch(() => null)) as ChatResponse | null
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0]
    if (!call || call.function.name !== options.toolName) {
      return err({ code: 'no-tool-call', message: 'the model answered without calling the tool' })
    }

    let args: unknown
    try {
      args = JSON.parse(call.function.arguments)
    } catch (cause) {
      return err({
        code: 'invalid-arguments',
        violations: [{ path: '(root)', message: `arguments are not JSON: ${String(cause)}` }],
      })
    }

    const parsed = contract.parse(args)
    if (!parsed.ok) return err({ code: 'invalid-arguments', violations: parsed.error })
    return ok(parsed.value)
  }

  /** A streamed reply. Text arrives in pieces; actions arrive as calls. */
  async converse(options: ConverseOptions): Promise<Result<AsyncIterable<ConverseEvent>, SidecarError>> {
    const response = await this.#post({
      model: this.#model,
      stream: true,
      messages: [{ role: 'system', content: options.system }, ...options.messages],
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(options.tools?.length
        ? {
            tools: options.tools.map((tool) => ({
              type: 'function',
              function: { name: tool.name, description: tool.description, parameters: tool.parameters },
            })),
            tool_choice: 'auto',
          }
        : {}),
    })
    if (!response.ok) return response
    const body = response.value.body
    if (!body) return err({ code: 'refused', status: response.value.status, message: 'the reply had no body' })
    return ok(read(body))
  }

  async #post(body: unknown): Promise<Result<Response, SidecarError>> {
    let response: Response
    try {
      response = await this.#fetch(`${this.#base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (cause) {
      return err({ code: 'unreachable', message: `${this.#base}: ${String(cause)}` })
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return err({ code: 'refused', status: response.status, message: text.slice(0, 400) })
    }
    return ok(response)
  }
}

async function* read(body: ReadableStream<Uint8Array>): AsyncGenerator<ConverseEvent> {
  for await (const data of sseData(body)) {
    if (data === '[DONE]') return
    let chunk: StreamChunk
    try {
      chunk = JSON.parse(data) as StreamChunk
    } catch {
      continue
    }
    const choice = chunk.choices?.[0]
    const text = choice?.delta?.content
    if (text) yield { kind: 'text', text }

    for (const call of choice?.delta?.tool_calls ?? []) {
      let args: unknown = {}
      try {
        args = JSON.parse(call.function.arguments)
      } catch {
        continue // a call whose arguments do not parse is not an action
      }
      yield { kind: 'call', name: call.function.name, arguments: args }
    }
    if (choice?.finish_reason) yield { kind: 'end', reason: choice.finish_reason }
  }
}

interface ChatResponse {
  choices?: Array<{ message?: { tool_calls?: Array<{ function: { name: string; arguments: string } }> } }>
}

interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> }
    finish_reason?: string | null
  }>
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.[name]
}
