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
