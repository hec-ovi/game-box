/**
 * Tests that point the engine at a real upstream. They set
 * GAME_BOX_LLM_UPSTREAM, which is process-wide, so they live in their own file
 * rather than racing the tests that expect the stand-in.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { chatResponseContract } from '../src/api/schema.ts'
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
    await post({ ...REQUEST, temperature: 0.4 })
    const sent = upstream.seen.at(-1)

    assert.deepEqual(sent?.tools, REQUEST.tools)
    assert.equal(sent?.tool_choice, 'auto')
    assert.equal(sent?.temperature, 0.4)
    assert.equal(sent?.stream, true)
    for (const cap of ['max_tokens', 'max_completion_tokens', 'max_new_tokens']) {
      assert.ok(!(cap in (sent ?? {})), `an output-length cap reached the engine: ${cap}`)
    }
  })
})
