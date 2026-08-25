import { err, ok, type Result, type SchemaViolation } from '@gb/kit'
import { stableJson } from '../stable-json.ts'

/**
 * What `extended` holds past `base`, when `base` is its prefix byte for byte.
 * A base entry changed, moved or gone is a problem at its index, because an
 * extension only ever adds.
 */
export function appended<T>(base: readonly T[], extended: readonly T[], path: string): Result<T[], SchemaViolation[]> {
  const problems: SchemaViolation[] = []
  base.forEach((entry, index) => {
    const other = extended[index]
    if (other === undefined) problems.push({ path: `${path}.${index}`, message: 'the base had this and the extension has not' })
    else if (stableJson(entry) !== stableJson(other)) problems.push({ path: `${path}.${index}`, message: 'changed since the base' })
  })
  return problems.length > 0 ? err(problems) : ok(extended.slice(base.length))
}

/** The entries of `extended` whose key `base` lacks; a base entry missing or changed under its key is a problem. */
export function addedByKey<T>(base: readonly T[], extended: readonly T[], keyOf: (entry: T) => string, path: string): Result<T[], SchemaViolation[]> {
  const after = new Map(extended.map((entry) => [keyOf(entry), entry]))
  const problems: SchemaViolation[] = []
  for (const entry of base) {
    const other = after.get(keyOf(entry))
    if (other === undefined) problems.push({ path: `${path}.${keyOf(entry)}`, message: 'the base had this and the extension has not' })
    else if (stableJson(entry) !== stableJson(other)) problems.push({ path: `${path}.${keyOf(entry)}`, message: 'changed since the base' })
  }
  if (problems.length > 0) return err(problems)
  const before = new Set(base.map(keyOf))
  return ok(extended.filter((entry) => !before.has(keyOf(entry))))
}
