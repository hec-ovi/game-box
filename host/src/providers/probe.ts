/**
 * Asking a provider something and reading the answer as one of four states, so
 * a screen can tell "nothing answered" from "it answered no" from "not now"
 * from "you have not finished setting it up". A server is asked over HTTP and
 * a command is asked by running it; both answer the same three shapes.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scrub } from '../secret.ts'
import { health as agentHealth, models as agentModels, test as agentTest } from './agent-probe.ts'
import { since } from './elapsed.ts'
import { reach, type Reached } from './engine.ts'
import type { Environment } from './paths.ts'
import type { FailedVerdict, Provider, ProviderHealth, ProviderModels, ProviderTest, ServerProvider } from './schema.ts'

/** A reachability check must not hang a settings screen; a real generation may take as long as it takes. */
const PATIENCE_MS = 15_000

const BUSY = 429

const PROMPT = readFileSync(join(import.meta.dirname, 'prompts', 'test.md'), 'utf8').trim()

type Answer =
  | { readonly heard: true; readonly status: number; readonly document: unknown; readonly ms: number }
  | {
      readonly heard: false
      readonly verdict: FailedVerdict
      readonly detail: string
      readonly status: number | null
      readonly ms: number
    }

/** Is it reachable, is its key present, does it answer. No generation. */
export async function health(provider: Provider, secret: string | undefined, env: Environment, gone?: AbortSignal): Promise<ProviderHealth> {
  if (provider.kind === 'agent') return agentHealth(provider, env, gone)
  // Only an external has a key to be set; a local server is asked for none.
  const key = provider.kind === 'external' ? { secretSet: secret !== undefined } : {}
  const answer = await listing(provider, secret, gone)
  const seen = { id: provider.id, ...key, status: answer.status ?? null, ms: answer.ms }
  return answer.heard ? { ...seen, verdict: 'ok' } : { ...seen, verdict: answer.verdict, detail: answer.detail }
}

/** What the provider says it can run, as it lists it on `/v1/models`. */
export async function models(provider: Provider, secret: string | undefined, env: Environment, gone?: AbortSignal): Promise<ProviderModels> {
  if (provider.kind === 'agent') return agentModels(provider, env, gone)
  const answer = await listing(provider, secret, gone)
  if (!answer.heard) return { id: provider.id, verdict: answer.verdict, ms: answer.ms, detail: answer.detail }

  const listed = (answer.document as { data?: unknown } | undefined)?.data
  const found = (Array.isArray(listed) ? listed : []).flatMap((entry: unknown) => {
    const row = entry as { id?: unknown; name?: unknown }
    if (typeof row?.id !== 'string' || row.id === '') return []
    return [typeof row.name === 'string' && row.name !== '' ? { id: row.id, label: row.name } : { id: row.id }]
  })
  return { id: provider.id, verdict: 'ok', ms: answer.ms, models: found.sort((a, b) => a.id.localeCompare(b.id)) }
}

/** One real generation, round trip: what it wrote, which model wrote it, how long it took. */
export async function test(provider: Provider, secret: string | undefined, env: Environment, gone?: AbortSignal): Promise<ProviderTest> {
  if (provider.kind === 'agent') return agentTest(provider, env, gone)
  const reached = reach(provider, secret)
  // No output-length cap, here as anywhere: the reply ends when the model ends it.
  const body = JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: PROMPT }], stream: false })
  const answer = reached.ok
    ? await ask(reached.value, reached.value.upstream.completions, { method: 'POST', headers: { 'content-type': 'application/json' }, body }, gone)
    : unset(reached.error)
  if (!answer.heard) return { id: provider.id, verdict: answer.verdict, ms: answer.ms, detail: answer.detail }

  const payload = answer.document as { model?: unknown; choices?: Array<{ message?: { content?: unknown } }> } | undefined
  const content = payload?.choices?.[0]?.message?.content
  return {
    id: provider.id,
    verdict: 'ok',
    ms: answer.ms,
    text: typeof content === 'string' ? content : '',
    model: typeof payload?.model === 'string' && payload.model !== '' ? payload.model : provider.model,
  }
}

/** The one cheap question, which both the status light and the model picker ask. */
async function listing(provider: ServerProvider, secret: string | undefined, gone?: AbortSignal): Promise<Answer> {
  const reached = reach(provider, secret)
  if (!reached.ok) return unset(reached.error)
  return ask(reached.value, reached.value.models, { method: 'GET' }, gone, PATIENCE_MS)
}

/** Nothing was asked, because there is not enough here to ask with. */
function unset(why: string): Answer {
  return { heard: false, verdict: 'misconfigured', detail: why, status: null, ms: 0 }
}

/**
 * One round trip, timed, with the answer read as a state. A credential is
 * scrubbed out of everything this reports, whatever the transport or the
 * provider put in its message.
 */
async function ask(reached: Reached, url: string, init: RequestInit, gone?: AbortSignal, patienceMs?: number): Promise<Answer> {
  const secret = reached.upstream.secret
  const patience = patienceMs === undefined ? undefined : AbortSignal.timeout(patienceMs)
  const signals = [gone, patience].filter((signal): signal is AbortSignal => signal !== undefined)
  const started = Date.now()

  let response: Response
  let body: string
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...init.headers, ...reached.upstream.headers },
      signal: signals.length > 0 ? AbortSignal.any(signals) : null,
    })
    body = await response.text()
  } catch (cause) {
    const why = patience?.aborted === true ? `nothing answered within ${Math.round((patienceMs ?? 0) / 1000)} s` : scrub(String(cause), secret)
    return { heard: false, verdict: 'unreachable', detail: `${why} (${url})`, status: null, ms: since(started) }
  }

  const ms = since(started)
  const document = documentIn(body)
  const error = errorIn(document)
  // A router can accept the request and only then learn the model is capped,
  // so a refusal arrives inside a 200 as readily as it arrives as the status.
  const refused = response.status === BUSY || !response.ok || error !== undefined
  if (!refused) return { heard: true, status: response.status, document, ms }

  const busy = response.status === BUSY || error?.code === BUSY
  const said = messageIn(error)
  const detail = said === undefined ? `status ${response.status}` : `status ${response.status}: ${said}`
  return { heard: false, verdict: busy ? 'busy' : 'refused', detail: scrub(detail, secret), status: response.status, ms }
}

function documentIn(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

interface UpstreamError {
  readonly code?: unknown
  readonly message?: unknown
  readonly metadata?: { readonly raw?: unknown }
}

function errorIn(document: unknown): UpstreamError | undefined {
  const error = (document as { error?: unknown } | undefined)?.error
  return error !== null && typeof error === 'object' ? (error as UpstreamError) : undefined
}

/**
 * What the provider itself said went wrong, rather than whatever page it
 * served. A router wraps the real sentence one level down, and that is the
 * half that names the model and what to do about it.
 */
function messageIn(error: UpstreamError | undefined): string | undefined {
  const said = [error?.message, error?.metadata?.raw].filter((part): part is string => typeof part === 'string' && part !== '')
  return said.length === 0 ? undefined : [...new Set(said)].join(': ')
}
