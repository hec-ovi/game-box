/**
 * The seal `@gb/bundle` puts on a shared city, redone here because a world may
 * not depend on the box that packs it.
 *
 * The fixture's hash was written by the real packer, so a wrong copy of this
 * arithmetic fails on the first run rather than agreeing with itself.
 */

/** The same bytes for the same content, whatever order the keys were built in. */
function stableJson(value: unknown): string {
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

/** SHA-256 of the stable form, hex. */
export async function sealOf(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(value)))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
