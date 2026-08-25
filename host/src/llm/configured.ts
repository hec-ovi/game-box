/** Which upstream this process is pointed at, read from the environment. */
import { err, ok, type Result } from '../result.ts'
import { upstreamFailed, type LlmError } from './errors.ts'
import type { Upstream } from './upstream.ts'

/** The word that selects the hosted router, as opposed to a URL of your own. */
const OPENROUTER = 'openrouter'
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const OPENROUTER_MODEL = 'stealth/ox-alpha'

/** Attribution only: it names the project on OpenRouter's listings and costs nothing. */
const ATTRIBUTION = {
  'HTTP-Referer': 'https://github.com/hec-ovi/game-box',
  'X-OpenRouter-Title': 'game-box',
}

export type Environment = Readonly<Record<string, string | undefined>>

/**
 * `undefined` means nothing is configured and the stand-in answers.
 *
 * `GAME_BOX_LLM_UPSTREAM` decides: unset for the stand-in, the word
 * `openrouter` for the hosted router, or the URL of an OpenAI-compatible
 * server of your own. A URL is always called unauthenticated, so a key sitting
 * in the environment can never be sent to a server it does not belong to.
 */
export function configuredUpstream(env: Environment): Result<Upstream | undefined, LlmError> {
  const choice = (env.GAME_BOX_LLM_UPSTREAM ?? '').trim()
  if (choice === '') return ok(undefined)
  if (choice === OPENROUTER) return openrouter(env)

  const completions = completionsUrl(choice)
  if (completions === undefined) return err(upstreamFailed('GAME_BOX_LLM_UPSTREAM is not a URL'))
  // llama-server reads a named tool choice as `auto` and cannot end a
  // `required` reply the model resists, so a call is forced through its grammar.
  return ok({ completions, model: 'default', forcing: 'json-schema' })
}

function openrouter(env: Environment): Result<Upstream | undefined, LlmError> {
  const key = (env.OPENROUTER_API_KEY ?? '').trim()
  if (key === '') return err(upstreamFailed('OPENROUTER_API_KEY is not set'))

  const completions = completionsUrl((env.GAME_BOX_OPENROUTER_BASE ?? '').trim() || OPENROUTER_BASE)
  if (completions === undefined) return err(upstreamFailed('GAME_BOX_OPENROUTER_BASE is not a URL'))
  return ok({
    completions,
    headers: { authorization: `Bearer ${key}`, ...ATTRIBUTION },
    model: OPENROUTER_MODEL,
    forcing: 'tool-choice',
    secret: key,
  })
}

/**
 * The OpenAI convention puts the version segment in the base, and
 * `https://openrouter.ai/api/v1` follows it. A local server is usually written
 * without one. Accept both rather than making people know which to leave off.
 */
function completionsUrl(base: string): string | undefined {
  let url: URL
  try {
    url = new URL(base)
  } catch {
    return undefined
  }
  const path = url.pathname.replace(/\/+$/, '')
  url.pathname = path.endsWith('/v1') ? `${path}/chat/completions` : `${path}/v1/chat/completions`
  return url.toString()
}
