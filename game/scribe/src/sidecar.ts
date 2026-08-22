import { err, ok, type Contract, type Result, type SchemaViolation } from '@gb/kit'

export type SidecarError =
  | { readonly code: 'unreachable'; readonly message: string }
  | { readonly code: 'refused'; readonly status: number; readonly message: string }
  | { readonly code: 'no-tool-call'; readonly message: string }
  | { readonly code: 'invalid-arguments'; readonly violations: readonly SchemaViolation[] }

export interface AskOptions {
  /** Prepended as the system message. */
  readonly system: string
  /** What the model is being asked to do. */
  readonly user: string
  /** Name of the tool it must call. Its schema is both the contract and the constraint. */
  readonly toolName: string
  readonly toolDescription: string
  readonly temperature?: number
}

const DEFAULT_BASE = 'http://127.0.0.1:8976'

/**
 * Asks the local sidecar for one structured answer. The model is given a single
 * tool and told to call it, so what comes back is a typed argument object
 * validated against the very schema the tool was built from, never prose.
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
    const body = {
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
    }

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

    const payload = (await response.json().catch(() => null)) as ChatResponse | null
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0]
    if (!call || call.function.name !== options.toolName) {
      return err({ code: 'no-tool-call', message: 'the model answered without calling the tool' })
    }

    let args: unknown
    try {
      args = JSON.parse(call.function.arguments)
    } catch (cause) {
      return err({ code: 'invalid-arguments', violations: [{ path: '(root)', message: `arguments are not JSON: ${String(cause)}` }] })
    }

    const parsed = contract.parse(args)
    if (!parsed.ok) return err({ code: 'invalid-arguments', violations: parsed.error })
    return ok(parsed.value)
  }
}

interface ChatResponse {
  choices?: Array<{
    message?: { tool_calls?: Array<{ function: { name: string; arguments: string } }> }
  }>
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.[name]
}
