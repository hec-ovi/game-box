import { forcedTool } from './forced.ts'
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
 * itself, or the tool's parameters as `response_format` with the choice set
 * to `none`, so the engine writes the arguments as its whole answer.
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

  body.tool_choice = 'none'
  body.response_format = { type: 'json_schema', json_schema: { name: tool.function.name, schema: tool.function.parameters } }
  return { body, forced: { tool, asked: 'json' } }
}
