/**
 * Lets a page served from this machine call the sidecar. The service listens on
 * loopback, but a browser still refuses a cross-origin call without these
 * headers, and the game page is on a different port from the service.
 *
 * Only local origins are answered. A page on the open internet can reach
 * 127.0.0.1 from someone's browser too, and it has no business driving their
 * model.
 */
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

export type Headers = Record<string, string>

/** The headers to answer this request with. Empty for anything not local. */
export function corsHeaders(origin: string | undefined): Headers {
  if (!origin || !LOCAL_ORIGIN.test(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    // the answer differs per origin, so a cache must not reuse one for another
    vary: 'origin',
    'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    // a page can only read a header it is told about, and the wait on a 429 is one it needs
    'access-control-expose-headers': 'retry-after',
    'access-control-max-age': '86400',
  }
}
