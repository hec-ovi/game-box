/** A saved provider turned into somewhere a request can actually be sent. */
import type { Upstream } from '../llm/upstream.ts'
import { err, ok, type Result } from '../result.ts'
import { attributionFor } from './openrouter.ts'
import type { Provider } from './schema.ts'
import { completionsUrl, modelsUrl } from './urls.ts'

export interface Reached {
  readonly upstream: Upstream
  /** Where this provider lists what it can run. */
  readonly models: string
}

/**
 * An external is called with its key and nothing without one, so a job can
 * never quietly go out unauthenticated. A local server is called with no
 * credential at all, whatever else the environment happens to hold.
 *
 * An external honours a tool choice as it is; a server of your own is asked
 * for a call through its grammar, which is what llama-server enforces.
 */
export function reach(provider: Provider, secret: string | undefined): Result<Reached, string> {
  if (provider.kind === 'local') {
    const base = `http://${provider.host}:${provider.port}`
    const completions = completionsUrl(base)
    const models = modelsUrl(base)
    if (completions === undefined || models === undefined) return err(`${base} is not an address`)
    return ok({ upstream: { completions, model: provider.model, forcing: 'json-schema' }, models })
  }

  const completions = completionsUrl(provider.base)
  const models = modelsUrl(provider.base)
  if (completions === undefined || models === undefined) return err(`${provider.base} is not a URL`)
  if (secret === undefined) return err(`${provider.secretName} is not set`)
  return ok({
    upstream: {
      completions,
      headers: { authorization: `Bearer ${secret}`, ...attributionFor(completions) },
      model: provider.model,
      forcing: 'tool-choice',
      secret,
    },
    models,
  })
}
