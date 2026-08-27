/**
 * The command family over real HTTP: a job pointed at a command-line agent,
 * asked for a forced call, and every way a run can fail. The command is a stub
 * that speaks agy's surface, so none of this needs agy installed.
 *
 * These point the configuration files and the binary at a temporary directory
 * through the environment, which is process-wide, so they live in their own file.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { chatResponseContract, errorContract } from '../src/api/schema.ts'
import { grammarSchema } from '../src/llm/grammar-schema.ts'
import { providerHealthContract, providerModelsContract, providerTestContract } from '../src/providers/schema.ts'
import { startHost, type RunningHost } from './support/host.ts'

const STUB = join(import.meta.dirname, 'support', 'agy-stub.mjs')

/** A tool whose arguments are exactly what the command was handed, so the call proves the request. */
const ECHO = {
  type: 'function',
  function: {
    name: 'echo_input',
    parameters: {
      type: 'object',
      properties: { prompt: { type: 'string' }, schema: { type: 'object' } },
      required: ['prompt', 'schema'],
      additionalProperties: false,
    },
  },
}

const MESSAGES = [
  { role: 'system', content: 'You write cities.' },
  { role: 'user', content: 'Name a rain-soaked port.' },
]

/** What the message list becomes as one turn: a command runs one turn per call. */
const TRANSCRIPT = 'system:\nYou write cities.\n\nuser:\nName a rain-soaked port.'

let host: RunningHost
let workspace: string

before(async () => {
  chmodSync(STUB, 0o755)
  workspace = mkdtempSync(join(tmpdir(), 'game-box-agy-test-'))
  process.env.GAME_BOX_CONFIG_FILE = join(workspace, '.game-box.json')
  process.env.GAME_BOX_SECRETS_FILE = join(workspace, '.env.local')
  process.env.GAME_BOX_AGY_BIN = STUB
  delete process.env.GAME_BOX_LLM_UPSTREAM
  delete process.env.OPENROUTER_API_KEY
  host = await startHost()
})

after(async () => {
  delete process.env.GAME_BOX_CONFIG_FILE
  delete process.env.GAME_BOX_SECRETS_FILE
  delete process.env.GAME_BOX_AGY_BIN
  await host.close()
  rmSync(workspace, { recursive: true, force: true })
})

/** One command provider with the city job pointed at it. The model chooses how the stub behaves. */
async function route(model: string, timeoutSeconds = 60): Promise<void> {
  const response = await fetch(`${host.base}/v1/providers`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      providers: [{ id: 'agy', kind: 'agent', label: 'agy', model, timeoutSeconds }],
      routes: { city: 'agy' },
    }),
  })
  assert.equal(response.status, 200, await response.text())
}

function ask(body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch(`${host.base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ job: 'city', ...(body as object) }),
    ...(signal === undefined ? {} : { signal }),
  })
}

/** A forced call: one tool, and the choice naming it. */
function forced(): unknown {
  return { messages: MESSAGES, tools: [ECHO], tool_choice: { type: 'function', function: { name: 'echo_input' } } }
}

async function failureOf(body: unknown = { messages: MESSAGES }): Promise<string> {
  const response = await ask(body)
  const answer = await response.json()
  assert.equal(response.status, 502, JSON.stringify(answer))
  assert.ok(errorContract.is(answer), `error off-contract: ${JSON.stringify(answer)}`)
  return answer.error.message
}

/**
 * How many stubs the engine has running. The engine always spawns it with
 * `--input-format` first, so this counts its children and nothing that merely
 * mentions the stub on a command line of its own.
 */
function stubsRunning(): number {
  const started = 'agy-stub.mjs --input-format'
  const listed = execFileSync('ps', ['-eo', 'args=', '-ww'], { encoding: 'utf8' })
  return listed.split('\n').filter((line) => line.includes(started)).length
}

describe('a job pointed at a command', () => {
  it('asks for the call as the tool s parameters, with the messages on stdin, and reads the enforced answer back as the call', async () => {
    await route('call')

    const body = await (await ask(forced())).json()

    assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
    const choice = body.choices[0]
    assert.equal(choice?.finish_reason, 'tool_calls')
    assert.equal(choice?.message.tool_calls?.[0]?.function.name, 'echo_input')

    const args = JSON.parse(choice?.message.tool_calls?.[0]?.function.arguments ?? 'null')
    assert.equal(args.prompt, TRANSCRIPT, 'the whole message list goes in as one turn')
    assert.deepEqual(args.schema, grammarSchema(ECHO.function.parameters), 'the schema the grammar is handed is the schema the command is handed')
    assert.equal(args.toolAction, undefined, 'the enforced answer is read, not the text the command decorates it with')
    assert.equal(body.salvaged, undefined, 'a call asked for as a schema is the answer by design, not a salvage')
  })

  // The command enforces the schema on its own answer, but a run can still end
  // in prose: its own turn timed out, or it answered without the tool. The JSON
  // in that prose is still the call it was.
  it('still reads a call out of a reply that arrived as prose', async () => {
    await route('prose')

    const body = await (await ask(forced())).json()

    assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
    const call = body.choices[0]?.message.tool_calls?.[0]
    assert.equal(call?.function.name, 'echo_input')
    assert.equal(JSON.parse(call?.function.arguments ?? 'null').prompt, TRANSCRIPT)
  })
})

// Four ways a run produces nothing, each with its own sentence: reported as
// one another they would send whoever reads them after the wrong thing.
describe('a run that produced nothing', () => {
  it('tells apart a non-zero exit, an answer that is not its result JSON, and a refusal it explained', async () => {
    await route('crash')
    assert.match(await failureOf(), /exited with status 3.*the stub fell over/s)

    await route('garbage')
    assert.match(await failureOf(), /is not its result JSON/)

    await route('refuses')
    assert.match(await failureOf(), /could not answer: the account has no credit/)
  })

  it('says a binary that is not there is not there', async () => {
    process.env.GAME_BOX_AGY_BIN = join(workspace, 'no-such-agent')
    try {
      await route('call')
      assert.match(await failureOf(), /no-such-agent is not installed on this machine/)
    } finally {
      process.env.GAME_BOX_AGY_BIN = STUB
    }
  })

  it('says a run that never came back ran out of time, and leaves nothing running', { timeout: 20_000 }, async () => {
    await route('hang', 1)

    assert.match(await failureOf(), /did not answer within 1 s/)
    assert.equal(stubsRunning(), 0)
  })
})

// A caller that gives up used to leave the command running to its own timeout,
// holding an account's rate limit for a reply nobody would read.
describe('a caller that leaves', () => {
  it('takes the command with it', { timeout: 20_000 }, async () => {
    await route('hang', 600)
    const caller = new AbortController()
    const reply = ask({ messages: MESSAGES }, caller.signal).catch(() => undefined)

    await until(() => stubsRunning() > 0)
    caller.abort()
    await reply

    await until(() => stubsRunning() === 0)
    assert.equal(stubsRunning(), 0)
  })
})

describe('asking a command how it is', () => {
  it('answers that the binary is there, lists what it can run, and proves it with one real run', async () => {
    await route('prose')

    const health = await (await fetch(`${host.base}/v1/providers/agy/health`)).json()
    assert.ok(providerHealthContract.is(health), `off-contract: ${JSON.stringify(health)}`)
    assert.equal(health.verdict, 'ok')
    assert.equal(health.status, null, 'a command answers no HTTP status')
    assert.match(health.detail ?? '', /9\.9\.9/)

    const models = await (await fetch(`${host.base}/v1/providers/agy/models`)).json()
    assert.ok(providerModelsContract.is(models), `off-contract: ${JSON.stringify(models)}`)
    assert.deepEqual(models.verdict === 'ok' ? models.models : [], [
      { id: 'stub-fast', label: 'Stub Fast' },
      { id: 'stub-slow', label: 'Stub Slow' },
    ])

    const tested = await (await fetch(`${host.base}/v1/providers/agy/test`, { method: 'POST' })).json()
    assert.ok(providerTestContract.is(tested), `off-contract: ${JSON.stringify(tested)}`)
    assert.equal(tested.verdict, 'ok')
    assert.match(tested.verdict === 'ok' ? tested.text : '', /rain-soaked port town/)
    assert.equal(tested.verdict === 'ok' && tested.model, 'prose')
  })
})

async function until(done: () => boolean, patienceMs = 10_000): Promise<void> {
  const deadline = Date.now() + patienceMs
  while (!done() && Date.now() < deadline) await new Promise((wake) => setTimeout(wake, 50))
}
