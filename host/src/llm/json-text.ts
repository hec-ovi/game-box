export type JsonObject = Record<string, unknown>

/**
 * The JSON object a piece of prose carries: the whole text, the inside of the
 * first code fence, or the span from the first brace to the last. Nothing
 * when none of those parses to an object.
 */
export function objectIn(text: string): JsonObject | undefined {
  const fence = /```[a-zA-Z]*\s*([\s\S]*?)```/.exec(text)
  const braces = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  for (const candidate of [text, fence?.[1], braces]) {
    const parsed = candidate === undefined ? undefined : objectOf(candidate)
    if (parsed !== undefined) return parsed
  }
  return undefined
}

function objectOf(text: string): JsonObject | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as JsonObject) : undefined
}
