/**
 * Generation by running a command instead of calling a server.
 *
 * One run per request, one turn, and the whole answer at the end. A run's
 * failures (a missing binary, a non-zero exit, a timeout, an answer that is
 * not the JSON it promised) are only known once it has ended, so the reply is
 * held until then and a run that failed is one error rather than half a reply.
 * The chat endpoint still streams it: as one token chunk and the closing
 * chunk, which is also what a forced call looks like on every other engine.
 */
import { err, ok, type Result } from '../../result.ts'
import type { CommandEngine } from '../engine.ts'
import { upstreamFailed, type LlmError } from '../errors.ts'
import { forcedTool } from '../forced.ts'
import { ForcedReply } from '../forced-reply.ts'
import type { GenerateRequest, TokenEvent } from '../schema.ts'
import { Agy } from './agy.ts'

/**
 * A call the request insists on is asked for as the tool's parameters, the
 * same schema the local grammar is handed, and the JSON that comes back is
 * read as the call. A run that answered prose instead still has its JSON read
 * out of it, so an answer that arrived the wrong way is not thrown away.
 */
export async function generate(
  engine: CommandEngine,
  request: GenerateRequest,
  gone?: AbortSignal,
): Promise<Result<AsyncIterable<TokenEvent>, LlmError>> {
  const tool = forcedTool(request)
  const answered = await new Agy(engine).answer(request, tool, gone)
  if (!answered.ok) return err(upstreamFailed(answered.error.message))

  const events = wholeReply(answered.value)
  return ok(tool === undefined ? events : new ForcedReply(tool, 'json').through(events))
}

async function* wholeReply(text: string): AsyncGenerator<TokenEvent> {
  if (text !== '') yield { type: 'token', text }
  yield { type: 'done', finishReason: 'stop' }
}

export { Child, exitDetail, safeEnvironment, type ChildError, type Ended } from './child.ts'
export { type CommandFailure } from './agy.ts'
