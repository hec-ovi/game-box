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

/** One step of a `number: value` list, covering everything up to its own number. */
export interface Band<T> {
  readonly upTo: number
  readonly value: T
}

/** A prompt list read as bands, lowest first. Keys that are not numbers are skipped. */
export function bands<T>(entries: Record<string, T>): ReadonlyArray<Band<T>> {
  return Object.entries(entries)
    .map(([upTo, value]) => ({ upTo: Number(upTo), value }))
    .filter((band) => Number.isFinite(band.upTo))
    .sort((a, b) => a.upTo - b.upTo)
}

/** The band a number falls in. Anything above them all belongs to the last. */
export function inBand<T>(list: ReadonlyArray<Band<T>>, at: number): T | undefined {
  return (list.find((band) => at <= band.upTo) ?? list[list.length - 1])?.value
}

/** A fragment of stored text, capitalised and punctuated so it can stand as a spoken sentence. */
export function sentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const capped = trimmed[0]!.toUpperCase() + trimmed.slice(1)
  return /[.!?]$/.test(capped) ? capped : `${capped}.`
}
