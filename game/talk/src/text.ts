/** Fills the {{holes}} in a prompt template. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match)
}

/** Reads a `key: text` list out of a prompt file. Blank lines and `#` lines are notes. */
export function keyed(source: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const colon = line.indexOf(':')
    if (colon < 1) continue
    out[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  return out
}

/** Reads a `key: one | two | three` list out of a prompt file. */
export function listed(source: string): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = {}
  for (const [key, value] of Object.entries(keyed(source))) {
    out[key] = value
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return out
}

/** A fragment of stored text, punctuated so it can sit in a spoken line. */
export function sentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}
