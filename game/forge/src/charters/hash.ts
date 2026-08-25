import type { Charter } from '@gb/world'

/**
 * A short digest of a charter's own fields, the same whatever order its keys
 * were written in: what a memo keyed on a word is keyed on beside the word, so
 * two cities in one process that both invent `jail` differently share nothing.
 */
export function charterHash(charter: Charter): string {
  let hash = 0x811c9dc5
  for (const char of canonical(charter)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** JSON with every object's keys in order, so a reordered document is the same text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([key, held]) => `${JSON.stringify(key)}:${canonical(held)}`).join(',')}}`
  }
  return JSON.stringify(value)
}
