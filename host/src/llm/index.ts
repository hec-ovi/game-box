/** Text generation: a chat-message list in, a stream of token events out. */
import { err, ok, type Result } from '../result.ts'
import { generate as runCommand } from './command/index.ts'
import { invalidRequest, type LlmError } from './errors.ts'
import { engineFor } from './routing.ts'
import { generateRequestContract, tokenEventContract, type TokenEvent } from './schema.ts'
import { generate as standin } from './standin.ts'
import { generate as proxy } from './upstream.ts'

/**
 * The whole boundary. Validates the request, then streams events that each
 * validate against the token-event contract, always ending in exactly one
 * `done`. Engine selection is internal: a request that names a job goes to the
 * provider assigned to it, and everything else goes where the environment
 * points. A server is proxied to and a command is run; both answer the same
 * events. `gone` aborts the engine's work, for a caller that left.
 */
export async function generate(request: unknown, gone?: AbortSignal): Promise<Result<AsyncIterable<TokenEvent>, LlmError>> {
  const parsed = generateRequestContract.parse(request)
  if (!parsed.ok) return err(invalidRequest(parsed.error))

  const engine = engineFor(parsed.value, process.env)
  if (!engine.ok) return engine
  if (engine.value === undefined) return ok(checked(fromArray(standin(parsed.value))))

  const produced =
    engine.value.transport === 'command'
      ? await runCommand(engine.value, parsed.value, gone)
      : await proxy(engine.value, parsed.value, gone)
  if (!produced.ok) return produced
  return ok(checked(produced.value))
}

/** Fail closed at the boundary: drop any event that does not validate. */
async function* checked(events: AsyncIterable<TokenEvent>): AsyncGenerator<TokenEvent> {
  for await (const event of events) {
    if (tokenEventContract.is(event)) yield event
  }
}

async function* fromArray(events: readonly TokenEvent[]): AsyncGenerator<TokenEvent> {
  for (const event of events) yield event
}

/** Everything the stream produced, for a caller that cannot stream. */
export async function collect(events: AsyncIterable<TokenEvent>): Promise<TokenEvent[]> {
  const out: TokenEvent[] = []
  for await (const event of events) out.push(event)
  return out
}

export type { LlmError } from './errors.ts'
export {
  GenerateRequestSchema,
  TokenEventSchema,
  generateRequestContract,
  tokenEventContract,
  type GenerateRequest,
  type Message,
  type TokenEvent,
  type Tool,
  type ToolCallEvent,
  type ToolChoice,
} from './schema.ts'
