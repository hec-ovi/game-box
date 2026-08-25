import type { GenerateRequest, Tool } from './schema.ts'

/**
 * How an upstream is asked for a call the request insists on. `tool-choice`
 * forwards the choice as it is; `json-schema` asks for the tool's parameters
 * as `response_format` and reads the JSON that comes back as the call.
 */
export type Forcing = 'tool-choice' | 'json-schema'

/**
 * The one tool a request insists on: the named one, or the only one offered
 * under `required`. `auto`, `none`, and `required` over several tools leave
 * the choice to the engine, so they force nothing.
 */
export function forcedTool(request: Pick<GenerateRequest, 'tools' | 'tool_choice'>): Tool | undefined {
  const choice = request.tool_choice
  const tools = request.tools ?? []
  if (typeof choice === 'object') return tools.find((tool) => tool.function.name === choice.function.name)
  if (choice === 'required' && tools.length === 1) return tools[0]
  return undefined
}
