import type { AskOptions, ConverseOptions, Routed, Sampling, ToolSpec } from './options.ts'

/** The sidecar's own `POST /v1/chat/completions` shapes. Nothing else builds or reads them. */

export function askBody(model: string, options: AskOptions, parameters: Record<string, unknown>): Record<string, unknown> {
  return {
    model,
    messages: [
      { role: 'system', content: options.system },
      { role: 'user', content: options.user },
    ],
    ...carried(options),
    tools: [tool({ name: options.toolName, description: options.toolDescription, parameters })],
    tool_choice: { type: 'function', function: { name: options.toolName } },
  }
}

export function converseBody(model: string, options: ConverseOptions): Record<string, unknown> {
  return {
    model,
    stream: true,
    messages: [{ role: 'system', content: options.system }, ...options.messages],
    ...carried(options),
    ...(options.tools?.length ? { tools: options.tools.map(tool), tool_choice: 'auto' } : {}),
  }
}

function tool(spec: ToolSpec) {
  return { type: 'function', function: { name: spec.name, description: spec.description, parameters: spec.parameters } }
}

/** Only what the caller named goes on the wire; the service invents nothing for what it leaves out. */
function carried({ job, temperature, seed }: Routed & Sampling) {
  return {
    ...(job === undefined ? {} : { job }),
    ...(temperature === undefined ? {} : { temperature }),
    ...(seed === undefined ? {} : { seed }),
  }
}

export interface ChatResponse {
  choices?: Array<{
    message?: { tool_calls?: Array<{ function: { name: string; arguments: string } }> }
    finish_reason?: string | null
  }>
}

export interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> }
    finish_reason?: string | null
  }>
}

/** The error body every non-2xx answer carries, as much of it as this box reads. */
export interface ErrorBody {
  error?: { message?: string; code?: string }
}
