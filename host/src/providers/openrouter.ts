/** What this service knows about OpenRouter itself, as opposed to any external. */

export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

/**
 * The model an OpenRouter request gets when it names none. Measured through
 * `tools/forced-call.ts`; see CONTRACT.md for what it answered.
 */
export const OPENROUTER_MODEL = 'google/gemma-4-31b-it:free'

/** Attribution only: it names the project on OpenRouter's listings and costs nothing. */
export const OPENROUTER_ATTRIBUTION = {
  'HTTP-Referer': 'https://github.com/hec-ovi/game-box',
  'X-OpenRouter-Title': 'game-box',
}

/**
 * Attribution belongs to OpenRouter's own listings, so it rides only on calls
 * that actually go there. Any other external is called with its key alone.
 */
export function attributionFor(url: string): Readonly<Record<string, string>> {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return {}
  }
  return host === 'openrouter.ai' || host.endsWith('.openrouter.ai') ? OPENROUTER_ATTRIBUTION : {}
}
