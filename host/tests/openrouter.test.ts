/**
 * The hosted upstream. Like the proxy tests these set environment variables,
 * which are process-wide, so they live in their own file.
 *
 * No real key is used and nothing here reaches openrouter.ai: the stub stands
 * in for it, and what is checked is the shape of the request that would go out.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { generate } from '../src/llm/upstream.ts'
import { startHost, type RunningHost } from './support/host.ts'
import { startUpstream, type RunningUpstream } from './support/upstream.ts'

const ANSWER = [
  '{"choices":[{"index":0,"delta":{"content":"Halveston."},"finish_reason":null}]}',
  '{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
]

const KEY = 'sk-or-v1-testonly-notarealkey'
const REQUEST = { messages: [{ role: 'user' as const, content: 'name a city' }] }

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
        secret: '404',
      },
      REQUEST,
    )

    assert.equal(result.ok, false)
    assert.equal(result.error.message, 'status ***')
  })
})
