/** A saved provider turned into the engine a request actually goes to. */
import type { CommandEngine, Engine } from '../llm/engine.ts'
import type { Upstream } from '../llm/upstream.ts'
import { err, ok, type Result } from '../result.ts'
import { agyBinary } from './agy.ts'
import { attributionFor } from './openrouter.ts'
import type { Environment } from './paths.ts'
import type { AgentProvider, Provider, ServerProvider } from './schema.ts'
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
export function reach(provider: ServerProvider, secret: string | undefined): Result<Reached, string> {
  if (provider.kind === 'local') {
    const base = `http://${provider.host}:${provider.port}`
    const completions = completionsUrl(base)
    const models = modelsUrl(base)
    if (completions === undefined || models === undefined) return err(`${base} is not an address`)
    return ok({ upstream: { transport: 'http', completions, model: provider.model, forcing: 'json-schema' }, models })
  }

  const completions = completionsUrl(provider.base)
  const models = modelsUrl(provider.base)
  if (completions === undefined || models === undefined) return err(`${provider.base} is not a URL`)
  if (secret === undefined) return err(`${provider.secretName} is not set`)
  return ok({
    upstream: {
      transport: 'http',
      completions,
      headers: { authorization: `Bearer ${secret}`, ...attributionFor(completions) },
      model: provider.model,
      forcing: 'tool-choice',
      secret,
    },
    models,
  })
}

/**
 * A command needs nothing configured beyond which binary to run, and that
 * belongs to the machine rather than to a configuration file that travels.
 */
export function command(provider: AgentProvider, env: Environment): CommandEngine {
  return {
    transport: 'command',
    binary: agyBinary(env),
    model: provider.model,
    timeoutMs: provider.timeoutSeconds * 1000,
  }
}

/** Where a job pointed at this provider ends up, whichever family it is. */
export function engineOf(provider: Provider, secret: string | undefined, env: Environment): Result<Engine, string> {
  if (provider.kind === 'agent') return ok(command(provider, env))
  const reached = reach(provider, secret)
  return reached.ok ? ok(reached.value.upstream) : err(reached.error)
}
