/**
 * Asks the same question several times and reports whether the answers come
 * back byte for byte identical.
 *
 *   GAME_BOX_LLM_UPSTREAM=http://127.0.0.1:8080 \
 *     node --experimental-strip-types tools/repeatable.ts
 *
 * Repeatability is the engine's property, not this service's, and it moves
 * with how the engine was started (parallel slots, prompt cache, speculative
 * decoding). Run this after changing those flags rather than assuming.
 */
import { createHash } from 'node:crypto'
import { listen } from '../src/server.ts'

const MESSAGES = [
  { role: 'system', content: 'You write terse setting notes for a cyberpunk city game.' },
  { role: 'user', content: 'Write a premise for a city named Halveston: one paragraph, then list four building kinds it needs.' },
]

interface Trial {
  readonly name: string
  readonly body: Record<string, unknown>
  readonly parallel: boolean
}

const TRIALS: readonly Trial[] = [
  { name: 'nothing pinned', body: {}, parallel: false },
  { name: 'seed only', body: { seed: 20260823 }, parallel: false },
  { name: 'temperature 0 only', body: { temperature: 0 }, parallel: false },
  { name: 'seed + temperature 0, one at a time', body: { seed: 20260823, temperature: 0 }, parallel: false },
  { name: 'seed + temperature 0, all at once', body: { seed: 20260823, temperature: 0 }, parallel: true },
]

interface Answer {
  readonly digest: string
  readonly ms: number
  readonly head: string
  readonly failed: boolean
}

/**
 * A hosted upstream rate-limits, and a refusal is not an answer: comparing one
 * against a reply would report a difference that says nothing about the model.
 * So a failed call is retried, and a trial that still could not get an answer
 * is reported as an error rather than as a difference.
 */
async function ask(base: string, body: Record<string, unknown>, attempts = 4): Promise<Answer> {
  const started = Date.now()
  let text = ''
  let failed = true
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await new Promise((wake) => setTimeout(wake, 15_000 * attempt))
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: MESSAGES, ...body }),
    })
    const payload: unknown = await response.json()
    failed = !response.ok
    text = failed ? `HTTP ${response.status}: ${JSON.stringify(payload)}` : contentOf(payload)
    if (!failed) break
  }
  return {
    digest: createHash('sha256').update(text).digest('hex').slice(0, 12),
    ms: Date.now() - started,
    head: text.slice(0, 72).replace(/\s+/g, ' '),
    failed,
  }
}

function contentOf(payload: unknown): string {
  const choices = (payload as { choices?: Array<{ message?: { content?: string } }> }).choices
  return choices?.[0]?.message?.content ?? ''
}

async function run(base: string, trial: Trial, runs: number): Promise<void> {
  const asks = Array.from({ length: runs }, () => () => ask(base, trial.body))
  const answers = trial.parallel ? await Promise.all(asks.map((a) => a())) : await inTurn(asks)

  const digests = answers.map((a) => a.digest)
  const broke = answers.some((a) => a.failed)
  const same = new Set(digests).size === 1
  const verdict = broke ? 'ERR ' : same ? 'SAME' : 'DIFF'
  const slowest = Math.max(...answers.map((a) => a.ms))
  console.log(`${verdict}  ${trial.name.padEnd(38)} ${digests.join(' ')}  ${slowest} ms`)
  if (!same || broke) for (const answer of answers) console.log(`        ${answer.digest}  ${answer.head}`)
}

async function inTurn(asks: ReadonlyArray<() => Promise<Answer>>): Promise<Answer[]> {
  const out: Answer[] = []
  for (const one of asks) out.push(await one())
  return out
}

const runs = Number.parseInt(process.argv[2] ?? '', 10) || 3
const { server, port } = await listen(0)
console.log(`engine: ${process.env.GAME_BOX_LLM_UPSTREAM ?? 'the stand-in'}, ${runs} runs per trial`)
try {
  for (const trial of TRIALS) await run(`http://127.0.0.1:${port}`, trial, runs)
} finally {
  server.closeAllConnections()
  server.close()
}
