import type { GenerateRequest, TokenEvent } from './schema.ts'

/**
 * The deterministic engine used when no upstream is configured. It echoes the
 * last thing the user said. Asked for a tool call, it makes the call with no
 * arguments: the caller's own schema is then what rejects it, rather than
 * prose being read as data.
 */
export function generate(request: GenerateRequest): TokenEvent[] {
  const forced = forcedTool(request)
  if (forced !== undefined) {
    return [
      { type: 'tool-call', name: forced, arguments: {} },
      { type: 'done', finishReason: 'stop' },
    ]
  }

  const lastUser = [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const events: TokenEvent[] = splitInclusive(`You said: ${lastUser}`, ' ').map((text) => ({ type: 'token', text }))
  events.push({ type: 'done', finishReason: 'stop' })
  return events
}

/** The tool the request insists on, if it insists on one. */
function forcedTool(request: GenerateRequest): string | undefined {
  const choice = request.tool_choice
  if (typeof choice === 'object') return choice.function.name
  if (choice !== 'required') return undefined
  return request.tools?.[0]?.function.name
}

/** Pieces that still carry their separator, so joining them rebuilds the text. */
function splitInclusive(text: string, separator: string): string[] {
  const out: string[] = []
  let start = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== separator) continue
    out.push(text.slice(start, i + 1))
    start = i + 1
  }
  if (start < text.length) out.push(text.slice(start))
  return out
}
