/** Which engine a request goes to: the job it names, or the environment. */
import { Providers } from '../providers/index.ts'
import { err, ok, type Result } from '../result.ts'
import { configuredUpstream, type Environment } from './configured.ts'
import { upstreamFailed, type LlmError } from './errors.ts'
import type { GenerateRequest } from './schema.ts'
import type { Upstream } from './upstream.ts'

/**
 * A job goes to the provider it is assigned to. A request that names no job,
 * or names one nothing is assigned to, goes where `GAME_BOX_LLM_UPSTREAM`
 * points, which is where every request went before jobs existed.
 */
export function upstreamFor(request: GenerateRequest, env: Environment): Result<Upstream | undefined, LlmError> {
  if (request.job !== undefined) {
    const routed = new Providers(env).upstreamForJob(request.job)
    if (!routed.ok) return err(upstreamFailed(routed.error))
    if (routed.value !== undefined) return ok(routed.value)
  }
  return configuredUpstream(env)
}
