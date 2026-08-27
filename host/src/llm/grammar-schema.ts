import { GrammarPattern } from './grammar-pattern.ts'

type Json = Record<string, unknown>

/**
 * A tool's parameters as the engine's grammar is handed them: the same schema
 * with every rule the grammar cannot enforce taken out of the grammar and put
 * into the field's own `description` instead, in words.
 *
 * Two rules cannot be enforced. A `pattern` the grammar reads wrongly is taken
 * out, because a class that matches a quote lets a string never end. And
 * `minLength` and `maxLength` are ignored by the grammar whenever a pattern
 * sits beside them, so a pattern that stays costs the bounds.
 *
 * Dropping either one silently is what leaves the engine unaware of a rule its
 * answer is about to be judged against, so it fails the check on the first
 * attempt and only hears the reason on the second. The description is the one
 * place a rule can be stated that the engine reads and the grammar does not
 * compile. The reply is still checked against the parameters as written, so
 * nothing a rule demands is lost either way: this only moves where the engine
 * is told.
 */
export function grammarSchema(parameters: Json): Json {
  return walk(parameters) as Json
}

function walk(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(walk)
  if (node === null || typeof node !== 'object') return node

  const source = node as Json
  const out: Json = {}
  for (const [key, value] of Object.entries(source)) {
    if (key === 'pattern' && typeof value === 'string') {
      const enforceable = GrammarPattern.enforceable(value)
      if (enforceable !== undefined) out.pattern = enforceable
      continue
    }
    out[key] = walk(value)
  }

  const said = unenforced(source, 'pattern' in out)
  if (said.length > 0) out.description = [source.description, ...said].filter(Boolean).join(' ')
  return out
}

/**
 * The rules this field carries that its grammar will not hold it to, each as a
 * sentence. A pattern is quoted as it was written: it is the exact thing the
 * answer is checked against, and an engine reads a regex better than a
 * paraphrase of one.
 */
function unenforced(source: Json, patternKept: boolean): string[] {
  const said: string[] = []
  const pattern = typeof source.pattern === 'string' ? source.pattern : undefined
  if (pattern !== undefined && !patternKept) said.push(`Must match the regular expression ${pattern}.`)

  // the grammar drops the bounds whenever a pattern rides beside them
  if (pattern === undefined || !patternKept) return said

  const min = typeof source.minLength === 'number' ? source.minLength : undefined
  const max = typeof source.maxLength === 'number' ? source.maxLength : undefined
  if (min !== undefined && max !== undefined) said.push(`Must be ${min} to ${max} characters long.`)
  else if (min !== undefined) said.push(`Must be at least ${min} characters long.`)
  else if (max !== undefined) said.push(`Must be no more than ${max} characters long.`)
  return said
}
