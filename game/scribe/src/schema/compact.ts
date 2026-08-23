/**
 * Hoists every subschema that appears more than once into `$defs` and leaves a
 * `$ref` behind.
 *
 * A contract's own JSON Schema is written for a validator, which does not care
 * that the same six conditions are spelled out inside all eleven step kinds.
 * The model pays for every one of those characters on every call, so the quest
 * tool arrived at 41,994 characters of mostly repeats. Hoisting is an identity:
 * dereference the result and the original schema comes back.
 */

export type JsonSchema = Record<string, unknown>

/** Keys whose value is one schema. */
const ONE = ['items', 'not', 'if', 'then', 'else', 'contains', 'propertyNames', 'additionalItems'] as const
/** Keys whose value is a map of name to schema. */
const MAP = ['properties', 'patternProperties', '$defs', 'definitions'] as const
/** Keys whose value is a list of schemas. */
const LIST = ['oneOf', 'anyOf', 'allOf', 'prefixItems'] as const

function isSchema(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Walks only the places a schema can legally sit, so a `properties` bag is never mistaken for one. */
function eachChild(node: JsonSchema, visit: (child: JsonSchema, replace: (next: JsonSchema) => void) => void): void {
  for (const key of ONE) {
    const value = node[key]
    if (isSchema(value)) visit(value, (next) => (node[key] = next))
  }
  const extra = node['additionalProperties']
  if (isSchema(extra)) visit(extra, (next) => (node['additionalProperties'] = next))
  for (const key of MAP) {
    const bag = node[key]
    if (!isSchema(bag)) continue
    for (const name of Object.keys(bag)) {
      const value = bag[name]
      if (isSchema(value)) visit(value, (next) => (bag[name] = next))
    }
  }
  for (const key of LIST) {
    const list = node[key]
    if (!Array.isArray(list)) continue
    list.forEach((value, i) => {
      if (isSchema(value)) visit(value as JsonSchema, (next) => (list[i] = next))
    })
  }
}

/** What a `$ref` costs to write, so a subschema is only hoisted when hoisting it saves characters. */
const REF_COST = '{"$ref":"#/$defs/d99"}'.length

export function compactSchema(schema: JsonSchema): JsonSchema {
  const root = structuredClone(schema)

  const seen = new Map<string, number>()
  const count = (node: JsonSchema): void => {
    seen.set(JSON.stringify(node), (seen.get(JSON.stringify(node)) ?? 0) + 1)
    eachChild(node, (child) => count(child))
  }
  eachChild(root, (child) => count(child))

  const worth = new Set(
    [...seen.entries()]
      .filter(([text, times]) => times > 1 && (text.length - REF_COST) * times > text.length + REF_COST)
      .map(([text]) => text),
  )
  if (worth.size === 0) return root

  const names = new Map<string, string>()
  const defs: Record<string, JsonSchema> = {}

  const hoist = (node: JsonSchema): JsonSchema => {
    const text = JSON.stringify(node)
    if (!worth.has(text)) {
      eachChild(node, (child, replace) => replace(hoist(child)))
      return node
    }
    let name = names.get(text)
    if (!name) {
      name = `d${names.size + 1}`
      names.set(text, name)
      const body = structuredClone(node)
      eachChild(body, (child, replace) => replace(hoist(child)))
      defs[name] = body
    }
    return { $ref: `#/$defs/${name}` }
  }
  eachChild(root, (child, replace) => replace(hoist(child)))

  return { ...root, $defs: defs }
}

/** Puts back what `compactSchema` hoisted. Only tests need this, and they need it. */
export function expandSchema(schema: JsonSchema): JsonSchema {
  const defs = (schema['$defs'] ?? {}) as Record<string, JsonSchema>
  const put = (node: JsonSchema): JsonSchema => {
    const ref = node['$ref']
    if (typeof ref === 'string') {
      const target = defs[ref.replace('#/$defs/', '')]
      if (!target) throw new Error(`dangling reference ${ref}`)
      return put(structuredClone(target))
    }
    eachChild(node, (child, replace) => replace(put(child)))
    return node
  }
  const root = structuredClone(schema)
  delete root['$defs']
  eachChild(root, (child, replace) => replace(put(child)))
  return root
}
