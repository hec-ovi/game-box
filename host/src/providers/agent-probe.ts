/**
 * The same three questions asked of a command: does the binary answer, what
 * does it list, and does one real generation come back. Each is a run of the
 * command in a temporary directory with none of this service's environment.
 */
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Child, exitDetail, generate, safeEnvironment, type ChildError, type Ended } from '../llm/command/index.ts'
import type { Result } from '../result.ts'
import { agyBinary } from './agy.ts'
import { since } from './elapsed.ts'
import { command } from './engine.ts'
import type { Environment } from './paths.ts'
import type { AgentProvider, ProviderHealth, ProviderModels, ProviderTest } from './schema.ts'

/** Asking whether a command is there must not hang a settings screen. */
const PATIENCE_MS = 15_000

const PROMPT = readFileSync(join(import.meta.dirname, 'prompts', 'test.md'), 'utf8').trim()

/** Is the binary there and does it answer. One version print, no generation. */
export async function health(provider: AgentProvider, env: Environment, gone?: AbortSignal): Promise<ProviderHealth> {
  const binary = agyBinary(env)
  const started = Date.now()
  const ended = await run(binary, ['--version'], env, gone)
  const ms = since(started)
  const seen = { id: provider.id, status: null, ms }

  if (!ended.ok) return { ...seen, verdict: 'unreachable', detail: ended.error.message }
  if (ended.value.code !== 0) return { ...seen, verdict: 'refused', detail: exitDetail(binary, ended.value) }
  return { ...seen, verdict: 'ok', detail: `${binary} ${ended.value.stdout.trim() || 'answered'}` }
}

/** What it says it can run, in the order it lists them. */
export async function models(provider: AgentProvider, env: Environment, gone?: AbortSignal): Promise<ProviderModels> {
  const binary = agyBinary(env)
  const started = Date.now()
  const ended = await run(binary, ['models'], env, gone)
  const ms = since(started)

  if (!ended.ok) return { id: provider.id, verdict: 'unreachable', ms, detail: ended.error.message }
  if (ended.value.code !== 0) return { id: provider.id, verdict: 'refused', ms, detail: exitDetail(binary, ended.value) }
  return { id: provider.id, verdict: 'ok', ms, models: listed(ended.value.stdout) }
}

/** One real generation through the command, uncapped like every other. */
export async function test(provider: AgentProvider, env: Environment, gone?: AbortSignal): Promise<ProviderTest> {
  const started = Date.now()
  const events = await generate(command(provider, env), { messages: [{ role: 'user', content: PROMPT }] }, gone)
  if (!events.ok) return { id: provider.id, verdict: 'unreachable', ms: since(started), detail: events.error.message }

  let text = ''
  for await (const event of events.value) if (event.type === 'token') text += event.text
  return { id: provider.id, verdict: 'ok', ms: since(started), text, model: provider.model }
}

function run(binary: string, args: readonly string[], env: Environment, gone?: AbortSignal): Promise<Result<Ended, ChildError>> {
  return new Child({
    binary,
    args,
    stdin: '',
    cwd: tmpdir(),
    env: safeEnvironment(env),
    timeoutMs: PATIENCE_MS,
  }).run(gone)
}

/** `agy models` writes one model per line: its id, a tab, and the name it goes by. */
function listed(stdout: string): { id: string; label?: string }[] {
  const found: { id: string; label?: string }[] = []
  for (const line of stdout.split('\n')) {
    const [rawId, rawLabel] = line.split('\t')
    const id = rawId?.trim() ?? ''
    const label = rawLabel?.trim() ?? ''
    if (id === '' || rawLabel === undefined) continue
    found.push(label === '' ? { id } : { id, label })
  }
  return found
}
