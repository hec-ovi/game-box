/** The generation layer: both engines, and the boundary in front of them. */
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { collect, generate, tokenEventContract, type TokenEvent } from '../src/llm/index.ts'
import { startUpstream, type RunningUpstream } from './support/upstream.ts'

let engine: RunningUpstream | undefined

afterEach(async () => {
  delete process.env.GAME_BOX_LLM_UPSTREAM
  await engine?.close()
  engine = undefined
})

async function events(request: unknown): Promise<TokenEvent[]> {
  const stream = await generate(request)
  assert.ok(stream.ok, `expected a stream, got ${JSON.stringify(stream)}`)
  const collected = await collect(stream.value)
  for (const event of collected) {
    assert.ok(tokenEventContract.is(event), `event off-contract: ${JSON.stringify(event)}`)
  }
  return collected
}

async function pointAt(payloads: readonly string[]): Promise<void> {
  engine = await startUpstream(payloads)
  process.env.GAME_BOX_LLM_UPSTREAM = engine.base
}

/** An upstream that answers with a tool call split across deltas, the way a real engine streams one. */
function toolCallStream(argumentFragments: readonly string[], finishReason: string): string[] {
  return [
    '{"choices":[{"index":0,"delta":{"tool_calls":[{"id":"call_1","type":"function","function":{"name":"name_city","arguments":""}}]},"finish_reason":null}]}',
    ...argumentFragments.map((fragment) =>
      JSON.stringify({
        choices: [{ index: 0, delta: { tool_calls: [{ function: { arguments: fragment } }] }, finish_reason: null }],
      }),
    ),
    JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: finishReason }] }),
  ]
}

const TOOL_REQUEST = {
  messages: [{ role: 'user', content: 'name a western town' }],
  tools: [
    {
      type: 'function',
      function: {
        name: 'name_city',
        description: 'Name the city',
        parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      },
    },
  ],
  tool_choice: { type: 'function', function: { name: 'name_city' } },
}

describe('the stand-in engine', () => {
  it('streams tokens and exactly one done', async () => {
    const collected = await events({
      messages: [
        { role: 'system', content: 'npc' },
        { role: 'user', content: 'hello there' },
      ],
    })

    const text = collected
      .filter((e) => e.type === 'token')
      .map((e) => e.text)
      .join('')
    assert.equal(text, 'You said: hello there')
    const dones = collected.filter((e) => e.type === 'done')
    assert.equal(dones.length, 1)
    assert.equal(dones[0]?.finishReason, 'stop')
    assert.equal(collected.at(-1)?.type, 'done')
  })

  it('makes the forced call with no arguments', async () => {
    const collected = await events(TOOL_REQUEST)
    assert.deepEqual(collected[0], { type: 'tool-call', name: 'name_city', arguments: {} })
    assert.equal(collected.at(-1)?.type, 'done')
  })
})

describe('the boundary', () => {
  it('rejects an invalid request before streaming', async () => {
    for (const bad of [
      {},
      { messages: [] },
      { messages: [{ role: 'wizard', content: 'hi' }] },
      { messages: [{ role: 'user', content: 'hi' }], extra: true },
    ]) {
      const stream = await generate(bad)
      assert.ok(!stream.ok, `expected a refusal for ${JSON.stringify(bad)}`)
      assert.equal(stream.error.code, 'invalid-request')
    }
  })
})

describe('the upstream engine', () => {
  it('parses openai sse', async () => {
    await pointAt([
      '{"choices":[{"index":0,"delta":{"content":"Hel"},"finish_reason":null}]}',
      '{"choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":null}]}',
      '{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
      '[DONE]',
    ])
    const collected = await events({ messages: [{ role: 'user', content: 'hi' }] })

    const text = collected
      .filter((e) => e.type === 'token')
      .map((e) => e.text)
      .join('')
    assert.equal(text, 'Hello')
    assert.deepEqual(collected.at(-1), { type: 'done', finishReason: 'stop' })
  })

  it('delivers a split tool call whole, with parsed arguments', async () => {
    await pointAt(toolCallStream(['{"na', 'me":"Dry ', 'Gulch"}'], 'tool_calls'))
    const collected = await events(TOOL_REQUEST)

    const calls = collected.filter((e) => e.type === 'tool-call')
    assert.equal(calls.length, 1, 'a split tool call must arrive as one event')
    assert.equal(calls[0]?.name, 'name_city')
    assert.deepEqual(calls[0]?.arguments, { name: 'Dry Gulch' })
    assert.equal(calls[0]?.id, 'call_1')
    assert.deepEqual(collected.at(-1), { type: 'done', finishReason: 'stop' })
  })

  it('never hands over arguments that do not parse', async () => {
    await pointAt(toolCallStream(['{"name": "Dry Gul'], 'tool_calls'))
    const collected = await events(TOOL_REQUEST)

    assert.ok(
      collected.every((e) => e.type !== 'tool-call'),
      'truncated arguments must not be emitted',
    )
    assert.deepEqual(collected.at(-1), { type: 'done', finishReason: 'error' })
  })
})
