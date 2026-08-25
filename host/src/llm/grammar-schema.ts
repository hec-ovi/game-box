import { GrammarPattern } from './grammar-pattern.ts'

type Json = Record<string, unknown>

/**
 * A tool's parameters as the engine's grammar is handed them: the same schema
 * with every `pattern` the grammar cannot enforce exactly taken out, so the
 * string it bounded is bounded by its `minLength` and `maxLength` instead, and
 * every other one spelled the way the grammar reads it. The reply is checked
 * against the parameters as written, so nothing a pattern demands is lost.
 */
export function grammarSchema(parameters: Json): Json {
  return walk(parameters) as Json
}

function walk(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(walk)
  if (node === null || typeof node !== 'object') return node
  const out: Json = {}
  for (const [key, value] of Object.entries(node as Json)) {
    if (key === 'pattern' && typeof value === 'string') {
      const enforceable = GrammarPattern.enforceable(value)
      if (enforceable !== undefined) out.pattern = enforceable
      continue
    }
    out[key] = walk(value)
  }
  return out
}
