/**
 * The hosted upstream. Like the proxy tests these set environment variables,
 * which are process-wide, so they live in their own file.
 *
 * No real key is used and nothing here reaches openrouter.ai: the stub stands
 * in for it, and what is checked is the shape of the request that would go out.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { chatResponseContract, chatStreamEventContract } from '../src/api/schema.ts'
import { generate } from '../src/llm/upstream.ts'
import { startHost, type RunningHost } from './support/host.ts'
import { startUpstream, type RunningUpstream } from './support/upstream.ts'

const ANSWER = [
  '{"choices":[{"index":0,"delta":{"content":"Halveston."},"finish_reason":null}]}',
  '{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
]

const KEY = 'sk-or-v1-testonly-notarealkey'
const REQUEST = { messages: [{ role: 'user' as const, content: 'name a city' }] }

const NAME_CITY = {
  type: 'function',
  function: {
    name: 'name_city',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
  },
}
const FORCED = { ...REQUEST, tools: [NAME_CITY], tool_choice: 'required' }

/** A model that wrote the arguments in a code block instead of calling, as measured on the local path. */
const PROSE_WITH_A_BLOCK = [
  '{"choices":[{"index":0,"delta":{"content":"Here is the city:\\n```json\\n{\\"name\\": \\"Halveston\\"}\\n```"},"finish_reason":null}]}',
  '{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
]

let host: RunningHost
let stub: RunningUpstream

before(async () => {
  stub = await startUpstream(ANSWER)
  host = await startHost()
})
after(async () => {
  delete process.env.GAME_BOX_LLM_UPSTREAM
  delete process.env.GAME_BOX_OPENROUTER_BASE
  delete process.env.OPENROUTER_API_KEY
  await host.close()
  await stub.close()
})

function post(body: unknown): Promise<Response> {
  return fetch(`${host.base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('the hosted upstream', () => {
  it('sends the key, the attribution and its own model, to a path that is not doubled', async () => {
    process.env.GAME_BOX_LLM_UPSTREAM = 'openrouter'
    process.env.OPENROUTER_API_KEY = KEY
    // the real base already carries the version segment, which is where a
    // naive join produces /v1/v1/chat/completions and every call 404s
    process.env.GAME_BOX_OPENROUTER_BASE = `${stub.base}/api/v1`

    assert.equal((await post(REQUEST)).status, 200)
    const sent = stub.seen.at(-1)

    assert.equal(sent?.url, '/api/v1/chat/completions')
    assert.equal(sent?.headers.authorization, `Bearer ${KEY}`)
    assert.equal(sent?.headers['x-openrouter-title'], 'game-box')
    assert.equal(sent?.body.model, 'stealth/ox-alpha')
  })

  it('refuses to route to it with no key rather than answering from the stand-in', async () => {
    process.env.GAME_BOX_LLM_UPSTREAM = 'openrouter'
    delete process.env.OPENROUTER_API_KEY

    const response = await post(REQUEST)

    assert.equal(response.status, 502)
    const body = await response.json()
    assert.equal((body as { error: { message: string } }).error.message, 'OPENROUTER_API_KEY is not set')
  })

  // A key in the environment belongs to OpenRouter and nobody else. Handing it
  // to whatever host GAME_BOX_LLM_UPSTREAM happens to name would post the
  // owner's credential to a server that never asked for it.
  it('never attaches the key to a server of your own', async () => {
    process.env.GAME_BOX_LLM_UPSTREAM = stub.base
    process.env.OPENROUTER_API_KEY = KEY

    assert.equal((await post(REQUEST)).status, 200)
    const sent = stub.seen.at(-1)

    assert.equal(sent?.headers.authorization, undefined)
    assert.equal(sent?.body.model, 'default')
  })
})

// The router honours the choice as it is (measured on gemma through
// OpenRouter), so it is forwarded unchanged; and a model that answers prose
// carrying the arguments anyway gets its call back, marked as rebuilt.
describe('a forced call through the hosted router', () => {
  before(() => {
    process.env.GAME_BOX_LLM_UPSTREAM = 'openrouter'
    process.env.OPENROUTER_API_KEY = KEY
    process.env.GAME_BOX_OPENROUTER_BASE = stub.base
  })
  after(() => stub.answerWith(ANSWER))

  it('goes out as the tool choice it was', async () => {
    assert.equal((await post(FORCED)).status, 200)
    const sent = stub.seen.at(-1)?.body

    assert.equal(sent?.tool_choice, 'required')
    assert.equal(sent?.response_format, undefined)
  })

  it('is rebuilt from a JSON block the model wrote instead of calling, and the reply counts it', async () => {
    stub.answerWith(PROSE_WITH_A_BLOCK)

    const body = await (await post(FORCED)).json()

    assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
    const choice = body.choices[0]
    assert.equal(choice?.finish_reason, 'tool_calls')
    assert.equal(choice?.message.tool_calls?.[0]?.function.name, 'name_city')
    assert.deepEqual(JSON.parse(choice?.message.tool_calls?.[0]?.function.arguments ?? 'null'), { name: 'Halveston' })
    assert.equal(choice?.message.content, undefined)
    assert.equal(body.salvaged, 1)
  })

  it('counts it on the chunk that carries the call when streaming', async () => {
    stub.answerWith(PROSE_WITH_A_BLOCK)

    const text = await (await post({ ...FORCED, stream: true })).text()
    const chunks = text
      .split('\n')
      .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
      .map((line): unknown => JSON.parse(line.slice(6)))

    const carrying = chunks.find((chunk) => chatStreamEventContract.is(chunk) && chunk.choices[0]?.delta.tool_calls !== undefined)
    assert.ok(chatStreamEventContract.is(carrying), `no chunk carried the call: ${text}`)
    assert.equal(carrying.salvaged, 1)
    assert.ok(chunks.every((chunk) => chatStreamEventContract.is(chunk)), `chunk off-contract: ${text}`)
  })
})

describe('a credential', () => {
  // Node stringifies every transport failure as a bare "TypeError: fetch
  // failed", so no real key can ride out on one today. The scrub is here so
  // that stays true by design rather than by luck, and the only way to watch
  // it work is to make the secret a string that a message really does carry:
  // the status code.
  it('is scrubbed out of every message the upstream produces', async () => {
    const result = await generate(
      {
        completions: `${host.base}/nope/v1/chat/completions`,
        headers: { authorization: 'Bearer 404' },
        model: 'whatever',
        forcing: 'tool-choice',
        secret: '404',
      },
      REQUEST,
    )

    assert.equal(result.ok, false)
    assert.ok(!result.error.message.includes('404'))
    // and it still says where it was trying to go
    assert.ok(result.error.message.includes('/nope/v1/chat/completions'))
  })
})
