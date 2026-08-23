import type { AskOptions, ConverseOptions, ToolSpec } from './options.ts'

/** The sidecar's own `POST /v1/chat/completions` shapes. Nothing else builds or reads them. */

export function askBody(model: string, options: AskOptions, parameters: Record<string, unknown>): Record<string, unknown> {
  return {
    model,
    messages: [
      { role: 'system', content: options.system },
      { role: 'user', content: options.user },
    ],
    ...temperature(options.temperature),
    tools: [tool({ name: options.toolName, description: options.toolDescription, parameters })],
    tool_choice: { type: 'function', function: { name: options.toolName } },
  }
}

export function converseBody(model: string, options: ConverseOptions): Record<string, unknown> {
  return {
    model,
    stream: true,
    messages: [{ role: 'system', content: options.system }, ...options.messages],
    ...temperature(options.temperature),
    ...(options.tools?.length ? { tools: options.tools.map(tool), tool_choice: 'auto' } : {}),
  }
}

function tool(spec: ToolSpec) {
  return { type: 'function', function: { name: spec.name, description: spec.description, parameters: spec.parameters } }
}

function temperature(value: number | undefined) {
  return value === undefined ? {} : { temperature: value }
}

export interface ChatResponse {
  choices?: Array<{ message?: { tool_calls?: Array<{ function: { name: string; arguments: string } }> } }>
}

export interface StreamChunk {
  choices?: Array<{
    delta?: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> }
    finish_reason?: string | null
  }>
}
