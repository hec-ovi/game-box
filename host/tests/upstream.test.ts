/**
 * Tests that point the engine at a real upstream. They set
 * GAME_BOX_LLM_UPSTREAM, which is process-wide, so they live in their own file
 * rather than racing the tests that expect the stand-in.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { chatResponseContract, errorContract } from '../src/api/schema.ts'
import { Backoff } from '../src/llm/backoff.ts'
import { startHost, type RunningHost } from './support/host.ts'
import { startUpstream, type RunningUpstream } from './support/upstream.ts'

/**
 * An engine that says something and calls a tool in the same reply, which is
 * what a real model does when an NPC talks and acts at once.
 */
const SPEAKING_AND_ACTING = [
  '{"choices":[{"index":0,"delta":{"content":"Take the ledger to Mara."},"finish_reason":null}]}',
  '{"choices":[{"index":0,"delta":{"tool_calls":[{"id":"c1","type":"function","function":{"name":"give_quest","arguments":"{\\"questId\\":\\"quest_0001\\"}"}}]},"finish_reason":null}]}',
  '{"choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}',
]

const REQUEST = {
  messages: [{ role: 'user', content: 'anything going on?' }],
  tools: [
    {
      type: 'function',
      function: {
        name: 'give_quest',
        parameters: { type: 'object', properties: { questId: { type: 'string' } }, required: ['questId'] },
      },
    },
  ],
  tool_choice: 'auto',
}

let host: RunningHost
let upstream: RunningUpstream

before(async () => {
  upstream = await startUpstream(SPEAKING_AND_ACTING)
  host = await startHost()
  process.env.GAME_BOX_LLM_UPSTREAM = upstream.base
})
after(async () => {
  delete process.env.GAME_BOX_LLM_UPSTREAM
  await host.close()
  await upstream.close()
})

function post(body: unknown): Promise<Response> {
  return fetch(`${host.base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('an upstream engine', () => {
  it('keeps both what the speaker said and what they did', async () => {
    const body = await (await post(REQUEST)).json()

    assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
    const choice = body.choices[0]
    assert.equal(choice?.finish_reason, 'tool_calls')
    assert.equal(choice?.message.content, 'Take the ledger to Mara.')
    assert.equal(choice?.message.tool_calls?.[0]?.function.name, 'give_quest')
  })

  it('is sent the tools unchanged and no output-length cap', async () => {
    await post(REQUEST)
    const sent = upstream.seen.at(-1)?.body

    assert.deepEqual(sent?.tools, REQUEST.tools)
    assert.equal(sent?.tool_choice, 'auto')
    assert.equal(sent?.stream, true)
    for (const cap of ['max_tokens', 'max_completion_tokens', 'max_new_tokens']) {
      assert.ok(!(cap in (sent ?? {})), `an output-length cap reached the engine: ${cap}`)
    }
  })

  it('is sent the seed and the temperature the caller pinned, together', async () => {
    await post({ ...REQUEST, seed: 20260823, temperature: 0 })
    const sent = upstream.seen.at(-1)?.body

    assert.equal(sent?.seed, 20260823)
    assert.equal(sent?.temperature, 0)
  })

  it('is sent no seed when the caller pinned none', async () => {
    await post(REQUEST)

    assert.ok(!('seed' in (upstream.seen.at(-1)?.body ?? {})), 'the host invented a seed nobody asked for')
  })

  // A broken engine answers 200 and writes the failure into the stream. Read
  // as a finished reply it becomes an empty answer that says it went fine, and
  // a caller builds a city out of nothing.
  it('calls a failure written into the stream a failure', async () => {
    upstream.answerWith(['{"error":{"code":500,"message":"decode() failed","type":"server_error"}}'])
    try {
      const body = await (await post(REQUEST)).json()

      assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
      assert.equal(body.choices[0]?.finish_reason, 'error')
    } finally {
      upstream.answerWith(SPEAKING_AND_ACTING)
    }
  })
})

/** What the host answers with once the engine has turned the request away. */
async function busyAnswer(body: unknown = REQUEST): Promise<{ status: number; retryAfter: string | null; body: unknown }> {
  const response = await post(body)
  return { status: response.status, retryAfter: response.headers.get('retry-after'), body: await response.json() }
}

// A capped free model answers 429 many times an hour. Reported as a dead
// engine it made the game retry in a tight loop; reported as busy, with a
// wait, the game can hold off and the player can be told the truth.
describe('a rate-limited engine', () => {
  after(() => upstream.answerWith(SPEAKING_AND_ACTING))

  it('is answered as busy, with the wait the engine asked for passed through', async () => {
    upstream.refuseWith(429, { 'retry-after': '7' })

    const answer = await busyAnswer({ ...REQUEST, stream: true })

    assert.equal(answer.status, 429)
    assert.equal(answer.retryAfter, '7')
    assert.ok(errorContract.is(answer.body), `error off-contract: ${JSON.stringify(answer.body)}`)
    assert.equal(answer.body.error.type, 'rate_limit_error')
    assert.equal(answer.body.error.code, 'model-busy')
  })

  it('is given a wait that grows per refusal when the engine named none, and starts over once it answers', async () => {
    upstream.refuseWith(429)
    const first = await busyAnswer()
    const second = await busyAnswer()

    upstream.answerWith(SPEAKING_AND_ACTING)
    assert.equal((await post(REQUEST)).status, 200)

    upstream.refuseWith(429)
    const again = await busyAnswer()

    assert.equal(first.retryAfter, String(Backoff.FIRST_SECONDS))
    assert.equal(second.retryAfter, String(Backoff.FIRST_SECONDS * 2))
    assert.equal(again.retryAfter, String(Backoff.FIRST_SECONDS))
  })

  // A router accepts the request, then learns the model is capped, and says
  // so as the first event of a 200. The payload is OpenRouter's, as measured.
  it('is answered as busy when the refusal is the first streamed event', async () => {
    upstream.answerWith([
      '{"id":"gen-1","object":"chat.completion.chunk","model":"unknown","provider":"Stealth","choices":[],"error":{"code":429,"message":"Provider returned error","metadata":{"error_type":"rate_limit_exceeded"}}}',
    ])

    const answer = await busyAnswer()

    assert.equal(answer.status, 429)
    assert.ok(errorContract.is(answer.body) && answer.body.error.code === 'model-busy')
  })

  it('is asked once per request: the host never retries on its own', async () => {
    upstream.refuseWith(429)
    const before = upstream.seen.length

    await busyAnswer()

    assert.equal(upstream.seen.length - before, 1)
  })
})
