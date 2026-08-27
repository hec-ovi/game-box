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

const GIVE_QUEST = {
  type: 'function',
  function: {
    name: 'give_quest',
    parameters: { type: 'object', properties: { questId: { type: 'string' } }, required: ['questId'] },
  },
}

const REQUEST = {
  messages: [{ role: 'user', content: 'anything going on?' }],
  tools: [GIVE_QUEST],
  tool_choice: 'auto',
}

/** The shape the game sends when it wants data: one tool, and the choice naming it. */
const FORCED = { ...REQUEST, tool_choice: { type: 'function', function: { name: 'give_quest' } } }

/** Strings bounded three ways: an escape the grammar lacks, a class that matches a quote, and a plain class. */
const SIGN_PARAMETERS = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: '^npc_\\d{4,}$' },
    sign: { type: 'string', minLength: 1, maxLength: 60, pattern: '^(?:[^{}]|\\{(?:family|noun)\\})+$' },
    blade: { type: 'string', pattern: '^[A-Z0-9 ]{2,8}$' },
    note: { type: 'string', minLength: 4, maxLength: 20, pattern: '^[A-Z ]+$' },
  },
  required: ['id', 'sign', 'blade'],
}
const SIGN_PLACE = { type: 'function', function: { name: 'sign_place', parameters: SIGN_PARAMETERS } }
const SIGN_FORCED = {
  messages: REQUEST.messages,
  tools: [SIGN_PLACE],
  tool_choice: { type: 'function', function: { name: 'sign_place' } },
}

/** An engine asked for JSON through its grammar writes the arguments as its whole answer. */
function jsonAnswer(text: string): string[] {
  return [
    `{"choices":[{"index":0,"delta":{"content":${JSON.stringify(text)}},"finish_reason":null}]}`,
    '{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
  ]
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

function post(body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch(`${host.base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
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

// llama-server reads a named tool choice as `auto` and answers prose, and a
// `required` reply the model resists never ends (measured on b10603 with
// gemma-4-26b-a4b). Its grammar does force a JSON schema, as long as no
// tools ride beside it, so a forced call goes out as the schema alone, and
// the JSON it writes is read back as the call.
describe('a forced call on a server of your own', () => {
  after(() => upstream.answerWith(SPEAKING_AND_ACTING))

  it('is asked for as the tool\'s parameters alone, and the JSON that comes back is the call', async () => {
    upstream.answerWith(jsonAnswer('{"questId":"quest_0001"}'))

    const body = await (await post(FORCED)).json()
    const sent = upstream.seen.at(-1)?.body

    assert.deepEqual(sent?.response_format, {
      type: 'json_schema',
      json_schema: { name: 'give_quest', schema: GIVE_QUEST.function.parameters },
    })
    assert.ok(!('tools' in (sent ?? {})) && !('tool_choice' in (sent ?? {})), 'the tools reached the engine beside the grammar')
    assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
    const choice = body.choices[0]
    assert.equal(choice?.finish_reason, 'tool_calls')
    assert.equal(choice?.message.tool_calls?.[0]?.function.name, 'give_quest')
    assert.deepEqual(JSON.parse(choice?.message.tool_calls?.[0]?.function.arguments ?? 'null'), { questId: 'quest_0001' })
    assert.equal(choice?.message.content, undefined)
    assert.equal(body.salvaged, undefined, 'a call asked for as JSON is the answer by design, not a salvage')
  })

  it('leaves JSON that does not fit the parameters as the prose it is', async () => {
    upstream.answerWith(jsonAnswer('{"quest":"quest_0001"}'))

    const body = await (await post(FORCED)).json()

    assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
    assert.equal(body.choices[0]?.finish_reason, 'stop')
    assert.equal(body.choices[0]?.message.tool_calls, undefined)
    assert.equal(body.choices[0]?.message.content, '{"quest":"quest_0001"}')
  })

  // llama.cpp's grammar copies a character class into the string rule as it
  // is, so a class that matches a quote lets a string never end (measured: a
  // charter ran past 300 s where it ends in 25 s without the pattern), and an
  // escape it does not know makes it accept any string (measured: step ids
  // like `step_0008_a` against `^step_\d{4,}$`).
  it('hands the grammar only the patterns it can end', async () => {
    upstream.answerWith(jsonAnswer('{"id":"npc_0001","sign":"{family} CUSTOMS","blade":"CUSTOMS"}'))

    const body = await (await post(SIGN_FORCED)).json()
    const sent = upstream.seen.at(-1)?.body
    const schema = (sent?.response_format as { json_schema: { schema: typeof SIGN_PARAMETERS } }).json_schema.schema

    assert.equal(schema.properties.id.pattern, '^npc_[0-9]{4,}$')
    assert.equal(schema.properties.sign.pattern, undefined)
    assert.equal(schema.properties.sign.minLength, 1)
    assert.equal(schema.properties.sign.maxLength, 60)
    assert.equal(schema.properties.blade.pattern, SIGN_PARAMETERS.properties.blade.pattern)
    assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
    assert.equal(body.choices[0]?.message.tool_calls?.[0]?.function.name, 'sign_place')
  })

  // A rule taken out of the grammar and never said is a rule the engine cannot
  // keep: it fails the check on the first attempt and only hears why on the
  // second. So whatever the grammar will not hold it to is said in words on
  // the field it applies to.
  it('says in the field description whatever the grammar was not handed', async () => {
    upstream.answerWith(jsonAnswer('{"id":"npc_0001","sign":"{family} CUSTOMS","blade":"CUSTOMS"}'))

    await post(SIGN_FORCED)
    const sent = upstream.seen.at(-1)?.body
    const schema = (sent?.response_format as { json_schema: { schema: typeof SIGN_PARAMETERS } }).json_schema.schema

    // the pattern the grammar cannot end is quoted on the field it bounded
    const sign = schema.properties.sign as { description?: string }
    assert.match(sign.description ?? '', /Must match the regular expression \^\(\?:\[\^\{\}\]/)

    // a pattern that stays costs the bounds, because the grammar ignores them
    // beside one, so those are said instead
    const note = schema.properties.note as { description?: string }
    assert.match(note.description ?? '', /Must be 4 to 20 characters long\./)

    // and a field the grammar holds to everything it was given says nothing extra
    const id = schema.properties.id as { description?: string }
    assert.equal(id.description, undefined)
    const blade = schema.properties.blade as { description?: string }
    assert.equal(blade.description, undefined)
  })

  it('still checks the reply against the pattern the grammar was not handed', async () => {
    upstream.answerWith(jsonAnswer('{"id":"npc_0001","sign":"{street} CUSTOMS","blade":"CUSTOMS"}'))

    const body = await (await post(SIGN_FORCED)).json()

    assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
    assert.equal(body.choices[0]?.finish_reason, 'stop')
    assert.equal(body.choices[0]?.message.tool_calls, undefined)
  })

  // A caller that gives up on a runaway reply used to leave the engine
  // decoding it to the end of its context, one slot gone for good.
  it('hangs up on the engine when the caller hangs up', { timeout: 5000 }, async () => {
    upstream.answerWith(['{"choices":[{"index":0,"delta":{"content":"{"},"finish_reason":null}]}'])
    const held = upstream.hold()
    const caller = new AbortController()
    const reply = post(FORCED, caller.signal).catch(() => undefined)

    await held.arrived
    caller.abort()

    await held.hungUp
    await reply
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
    upstream.refuseWith(429, undefined, { 'retry-after': '7' })

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
