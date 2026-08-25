/**
 * A `Retry-After` header as whole seconds from now. The header is either a
 * count of seconds, passed through as it is, or an HTTP date, in which case
 * the wait is however long remains until it. Anything else is no header.
 */
export function retryAfterSeconds(header: string | null, now = Date.now()): number | undefined {
  if (header === null) return undefined
  const value = header.trim()
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10)
  const at = Date.parse(value)
  if (Number.isNaN(at)) return undefined
  return Math.max(0, Math.ceil((at - now) / 1000))
}
