/**
 * Order two art pack versions. Dotted numbers compare field by field, so
 * `1.10.0` is newer than `1.9.3`; anything that is not all numbers falls back
 * to text order, which still tells the same version from a different one.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  if (a === b) return 0
  const left = fields(a)
  const right = fields(b)
  if (!left || !right) return a < b ? -1 : 1
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const step = (left[i] ?? 0) - (right[i] ?? 0)
    if (step !== 0) return step < 0 ? -1 : 1
  }
  return 0
}

function fields(version: string): number[] | undefined {
  const parts = version.split('.')
  return parts.every((part) => /^\d+$/.test(part)) ? parts.map(Number) : undefined
}
