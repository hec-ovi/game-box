/**
 * Asks the configured upstream for a forced tool call and reports what came
 * back, per model and per request shape, so a model that ignores
 * `tool_choice` can be told apart from a request shape the upstream rejects.
 *
 *   GAME_BOX_LLM_UPSTREAM=openrouter \
 *     node --env-file=.env --experimental-strip-types tools/forced-call.ts [model ...]
 *
 * The streamed shape goes through this service's own upstream code, exactly
 * as the game's requests do. The non-streamed shape is the same request with
 * `stream: false`, sent directly, because this service never sends one.
 * A busy answer is waited out for as long as it asked and tried again, a few
 * times, because a shared free pool refuses often and a refusal says nothing
 * about the model. The key is read from the environment and printed nowhere.
 */
import { configuredUpstream } from '../src/llm/configured.ts'
import { collect } from '../src/llm/index.ts'
import type { GenerateRequest, ToolChoice } from '../src/llm/schema.ts'
import { generate, type Upstream } from '../src/llm/upstream.ts'

const TOOL = {
  type: 'function' as const,
  function: {
    name: 'name_city',
    description: 'Name the city and say what it is known for',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' }, knownFor: { type: 'string' } },
      required: ['name', 'knownFor'],
      additionalProperties: false,
    },
  },
}

const MESSAGES = [
  { role: 'system' as const, content: 'You invent settings for a rain-soaked port city game.' },
  { role: 'user' as const, content: 'Name the city.' },
]

const CHOICES: readonly ToolChoice[] = [{ type: 'function', function: { name: TOOL.function.name } }, 'required']

interface Outcome {
  readonly status: string
  readonly content: string
  readonly call: string
  /** Seconds to wait before this is worth asking again; unset when it is not a refusal. */
  readonly busyFor?: number
}

const ATTEMPTS = 6
/** What to wait on a bare 429 with no Retry-After, the shape the free pool sends. */
const BARE_BUSY_SECONDS = 20

function requestFor(model: string, choice: ToolChoice): GenerateRequest {
  return { model, messages: MESSAGES, tools: [TOOL], tool_choice: choice }
}

/** The shape the game sends: streamed, read by this service's own parser. */
async function streamed(upstream: Upstream, request: GenerateRequest): Promise<Outcome> {
  const result = await generate(upstream, request)
  if (!result.ok) {
    const outcome: Outcome = { status: `${result.error.code}: ${result.error.message}`, content: '', call: '' }
    if (result.error.code !== 'busy') return outcome
    return { ...outcome, busyFor: Math.max(result.error.retryAfterSeconds, BARE_BUSY_SECONDS) }
  }
  const events = await collect(result.value)
  const call = events.find((e) => e.type === 'tool-call')
  return {
    status: `finish ${events.findLast((e) => e.type === 'done')?.finishReason ?? 'none'}`,
    content: events
      .filter((e) => e.type === 'token')
      .map((e) => e.text)
      .join(''),
    call: call ? `${call.name}(${JSON.stringify(call.arguments)})` : '',
  }
}

/** The same request with `stream: false`, read as one JSON document. */
async function unstreamed(upstream: Upstream, request: GenerateRequest): Promise<Outcome> {
  const response = await fetch(upstream.completions, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...upstream.headers },
    body: JSON.stringify({ ...request, stream: false }),
  })
  if (response.status === 429) {
    const busyFor = Number.parseInt(response.headers.get('retry-after') ?? '', 10) || BARE_BUSY_SECONDS
    return { status: 'HTTP 429', content: '', call: '', busyFor }
  }
  if (!response.ok) return { status: `HTTP ${response.status}`, content: '', call: '' }
  const payload = (await response.json()) as {
    choices?: Array<{
      finish_reason?: string
      message?: { content?: string | null; tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> }
    }>
  }
  const choice = payload.choices?.[0]
  const call = choice?.message?.tool_calls?.[0]?.function
  return {
    status: `finish ${choice?.finish_reason ?? 'none'}`,
    content: choice?.message?.content ?? '',
    call: call ? `${call.name}(${call.arguments})` : '',
  }
}

/** Ask until it is not a refusal, or the attempts run out. */
async function patiently(ask: () => Promise<Outcome>): Promise<Outcome> {
  let outcome = await ask()
  for (let attempt = 1; attempt < ATTEMPTS; attempt += 1) {
    const wait = outcome.busyFor
    if (wait === undefined) break
    await new Promise((wake) => setTimeout(wake, wait * 1000))
    outcome = await ask()
  }
  return outcome
}

function line(model: string, shape: string, choice: ToolChoice, outcome: Outcome): string {
  const chosen = typeof choice === 'string' ? choice : `named`
  const content = outcome.content === '' ? 'no content' : `content ${JSON.stringify(outcome.content.slice(0, 40))}`
  const call = outcome.call === '' ? 'NO CALL' : `call ${outcome.call.slice(0, 80)}`
  return `${model.padEnd(24)} ${shape.padEnd(12)} ${chosen.padEnd(9)} ${outcome.status.padEnd(20)} ${content}  ${call}`
}

const configured = configuredUpstream(process.env)
if (!configured.ok || configured.value === undefined) {
  console.error(configured.ok ? 'no upstream configured' : configured.error.message)
  process.exit(1)
}
const upstream = configured.value
const models = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [upstream.model]

for (const model of models) {
  for (const choice of CHOICES) {
    const request = requestFor(model, choice)
    console.log(line(model, 'stream true', choice, await patiently(() => streamed(upstream, request))))
    console.log(line(model, 'stream false', choice, await patiently(() => unstreamed(upstream, request))))
  }
}
