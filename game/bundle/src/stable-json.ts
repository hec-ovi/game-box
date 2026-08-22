/**
 * The same bytes for the same content, whatever order the keys were built in.
 * Two people who generated the same city must hash to the same string.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(sort(value))
}

function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sort((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

/** SHA-256 of the stable form, hex. Works in Node and in the browser. */
export async function contentHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
