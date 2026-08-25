/**
 * Sends a saved chat request through the running service, several at once,
 * and prints per reply the seconds it took, how it finished, whether the call
 * came back, and whether its arguments fit the tool's own parameters. For
 * seeing what a real request (a charter, a quest) does through this service,
 * against the engine as it is actually started.
 *
 *   node --experimental-strip-types tools/replay.ts <request.json> [times] [at-once] [cap-seconds]
 *
 * The request is the body a client sends `POST /v1/chat/completions`, as
 * saved by that client. Each copy gets its own seed, the saved one plus its
 * index, so the copies are different draws. The service is read from
 * `GAME_BOX_URL`, default `http://127.0.0.1:8976`.
 */
import { readFileSync } from 'node:fs'
import { ArgumentSchema } from '../src/llm/argument-schema.ts'
import type { Tool } from '../src/llm/schema.ts'

interface Reply {
  readonly seconds: number
  readonly status: string
  readonly outcome: string
}

interface Completion {
  readonly choices?: Array<{
    finish_reason?: string
    message?: { content?: string; tool_calls?: Array<{ function?: { arguments?: string } }> }
  }>
  readonly salvaged?: number
}

const [file, times = '1', atOnce = '1', capSeconds = '120'] = process.argv.slice(2)
if (file === undefined) {
  console.error('usage: replay.ts <request.json> [times] [at-once] [cap-seconds]')
  process.exit(1)
}
const base = process.env.GAME_BOX_URL ?? 'http://127.0.0.1:8976'
const request = JSON.parse(readFileSync(file, 'utf8')) as { seed?: number; tools?: Tool[] }
const tool = request.tools?.[0]
const fits = tool === undefined ? undefined : new ArgumentSchema(tool)

async function once(index: number): Promise<Reply> {
  const body = { ...request, stream: false, ...(request.seed === undefined ? {} : { seed: request.seed + index }) }
  const started = Date.now()
  const capped = AbortSignal.timeout(Number(capSeconds) * 1000)
  try {
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: capped,
    })
    const seconds = (Date.now() - started) / 1000
    if (!response.ok) return { seconds, status: `HTTP ${response.status}`, outcome: (await response.text()).slice(0, 80) }
    return { seconds, status: 'HTTP 200', outcome: outcomeOf((await response.json()) as Completion) }
  } catch (cause) {
    const seconds = (Date.now() - started) / 1000
    return { seconds, status: capped.aborted ? `capped at ${capSeconds} s` : 'failed', outcome: capped.aborted ? '' : String(cause) }
  }
}

function outcomeOf(completion: Completion): string {
  const choice = completion.choices?.[0]
  const call = choice?.message?.tool_calls?.[0]?.function?.arguments
  if (call === undefined) return `prose, finish ${choice?.finish_reason ?? 'none'}, ${choice?.message?.content?.length ?? 0} chars`
  const fit = fits === undefined ? 'unchecked' : fits.accepts(JSON.parse(call)) ? 'fits' : 'DOES NOT FIT'
  return `call, ${fit}${completion.salvaged === undefined ? '' : ', salvaged'}`
}

const replies: Reply[] = []
for (let start = 0; start < Number(times); start += Number(atOnce)) {
  const wave = Array.from({ length: Math.min(Number(atOnce), Number(times) - start) }, (_, i) => once(start + i))
  for (const reply of await Promise.all(wave)) {
    replies.push(reply)
    console.log(`${String(replies.length).padStart(3)}  ${reply.seconds.toFixed(1).padStart(6)} s  ${reply.status.padEnd(14)} ${reply.outcome}`)
  }
}
const seconds = replies.map((r) => r.seconds)
const calls = replies.filter((r) => r.outcome.startsWith('call, fits')).length
console.log(
  `${replies.length} replies: ${calls} calls that fit, ${replies.length - calls} not; ` +
    `${Math.min(...seconds).toFixed(1)} to ${Math.max(...seconds).toFixed(1)} s, ${(seconds.reduce((a, b) => a + b, 0) / seconds.length).toFixed(1)} s mean`,
)
