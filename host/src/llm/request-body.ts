import { forcedTool } from './forced.ts'
import { grammarSchema } from './grammar-schema.ts'
import type { Asked } from './forced-reply.ts'
import { samplingOf } from './sampling.ts'
import type { GenerateRequest, Tool } from './schema.ts'
import type { Upstream } from './upstream.ts'

/** The call a request insists on, and the shape it was asked for in. */
export interface ForcedCall {
  readonly tool: Tool
  readonly asked: Asked
}

export interface UpstreamRequest {
  readonly body: Record<string, unknown>
  readonly forced: ForcedCall | undefined
}

/**
 * The JSON body an upstream is sent. Messages, sampler settings and tools go
 * as they are, and no output-length cap is ever added. A call the request
 * insists on is asked for in the shape this upstream honours: the tool choice
 * itself, or the tool's parameters as `response_format` and nothing else of
 * the tools, so the engine writes the arguments as its whole answer. The
 * tools stay out of that request because llama-server does not enforce a
 * `response_format` grammar while they are present (measured: ids written
 * `step_001` against `^step_[0-9]{4,}$` with the tools sent, `step_0001`
 * without). The schema sent is the one the grammar can end, see
 * `grammar-schema.ts`.
 */
export function upstreamRequest(upstream: Upstream, request: GenerateRequest): UpstreamRequest {
  const body: Record<string, unknown> = {
    model: request.model ?? upstream.model,
    messages: request.messages,
    stream: true,
    ...samplingOf(request),
  }
  if (request.tools !== undefined) body.tools = request.tools
  if (request.tool_choice !== undefined) body.tool_choice = request.tool_choice

  const tool = forcedTool(request)
  if (tool === undefined) return { body, forced: undefined }
  if (upstream.forcing === 'tool-choice') return { body, forced: { tool, asked: 'call' } }

  delete body.tools
  delete body.tool_choice
  body.response_format = { type: 'json_schema', json_schema: { name: tool.function.name, schema: grammarSchema(tool.function.parameters) } }
  return { body, forced: { tool, asked: 'json' } }
}
