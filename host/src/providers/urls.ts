/**
 * The OpenAI convention puts the version segment in the base, and
 * `https://openrouter.ai/api/v1` follows it. A local server is usually written
 * without one. Accept both rather than making people know which to leave off.
 */
export function completionsUrl(base: string): string | undefined {
  return joined(base, 'chat/completions')
}

/** Where an OpenAI-compatible server lists what it can run. */
export function modelsUrl(base: string): string | undefined {
  return joined(base, 'models')
}

function joined(base: string, path: string): string | undefined {
  let url: URL
  try {
    url = new URL(base)
  } catch {
    return undefined
  }
  const trimmed = url.pathname.replace(/\/+$/, '')
  url.pathname = trimmed.endsWith('/v1') ? `${trimmed}/${path}` : `${trimmed}/v1/${path}`
  return url.toString()
}
