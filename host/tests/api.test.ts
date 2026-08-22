/** The public surface over real HTTP and a real WebSocket. */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import {
  chatResponseContract,
  chatStreamEventContract,
  errorContract,
  realtimeServerEventContract,
} from '../src/api/schema.ts'
import { chunkOfMs } from './support/audio.ts'
import { startHost, type RunningHost } from './support/host.ts'
import { TestSocket } from './support/socket.ts'

let host: RunningHost

before(async () => {
  host = await startHost()
})
after(async () => {
  await host.close()
})

function post(body: unknown): Promise<Response> {
  return fetch(`${host.base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** The tool a caller offers when it wants structured data rather than prose. */
function nameCityRequest(content: string): Record<string, unknown> {
  return {
    messages: [{ role: 'user', content }],
    tools: [
      {
        type: 'function',
        function: {
          name: 'name_city',
          description: 'Name the city',
          parameters: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'name_city' } },
  }
}

function dataLines(body: string): string[] {
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6))
}

describe('GET /health', () => {
  it('reports ok', async () => {
    const body = (await (await fetch(`${host.base}/health`)).json()) as Record<string, unknown>
    assert.equal(body.status, 'ok')
    assert.equal(body.service, 'game-box')
  })
})

describe('POST /v1/chat/completions', () => {
  it('returns a full completion when not streaming', async () => {
    const response = await post({ messages: [{ role: 'user', content: 'open the gate' }] })
    assert.equal(response.status, 200)

    const body = await response.json()
    assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
    assert.equal(body.choices[0]?.message.content, 'You said: open the gate')
    assert.equal(body.choices[0]?.finish_reason, 'stop')
  })

  it('streams sse chunks then [DONE]', async () => {
    const response = await post({ stream: true, messages: [{ role: 'user', content: 'hi' }] })
    assert.equal(response.status, 200)
    assert.ok(
      response.headers.get('content-type')?.startsWith('text/event-stream'),
      `got ${response.headers.get('content-type')}`,
    )

    const datas = dataLines(await response.text())
    assert.equal(datas.at(-1), '[DONE]')

    let streamed = ''
    let finish: string | null = null
    for (const data of datas.slice(0, -1)) {
      const chunk: unknown = JSON.parse(data)
      assert.ok(chatStreamEventContract.is(chunk), `chunk off-contract: ${data}`)
      const choice = chunk.choices[0]
      if (choice?.delta.content !== undefined) streamed += choice.delta.content
      if (choice?.finish_reason != null) finish = choice.finish_reason
    }
    assert.equal(streamed, 'You said: hi')
    assert.equal(finish, 'stop')
  })

  it('refuses a body that is not on the contract', async () => {
    for (const body of [
      'not json at all',
      JSON.stringify({ messages: [] }),
      JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
    ]) {
      const response = await post(body)
      assert.equal(response.status, 400, `body: ${body}`)
      const error = await response.json()
      assert.ok(errorContract.is(error), `error off-contract: ${JSON.stringify(error)}`)
      assert.equal(error.error.type, 'invalid_request_error')
    }
  })

  it('answers a forced tool call as tool_calls', async () => {
    const response = await post(nameCityRequest('name a western town'))
    assert.equal(response.status, 200)

    const body = await response.json()
    assert.ok(chatResponseContract.is(body), `response off-contract: ${JSON.stringify(body)}`)
    const choice = body.choices[0]
    assert.equal(choice?.finish_reason, 'tool_calls')
    const call = choice?.message.tool_calls?.[0]
    assert.equal(call?.type, 'function')
    assert.equal(call?.function.name, 'name_city')
    // arguments cross as JSON text, as the OpenAI shape requires
    const args: unknown = JSON.parse(call?.function.arguments ?? 'null')
    assert.ok(args !== null && typeof args === 'object')
    assert.equal(choice?.message.content, undefined)
  })

  it('sends the tool call as a chunk when streaming', async () => {
    const body = await (await post({ ...nameCityRequest('name a western town'), stream: true })).text()

    let sawCall = false
    for (const data of dataLines(body)) {
      if (data === '[DONE]') continue
      const chunk: unknown = JSON.parse(data)
      assert.ok(chatStreamEventContract.is(chunk), `chunk off-contract: ${data}`)
      if (chunk.choices[0]?.delta.tool_calls?.[0]?.function.name === 'name_city') sawCall = true
    }
    assert.ok(sawCall, 'the stream never carried the tool call')
    assert.ok(body.trimEnd().endsWith('data: [DONE]'))
  })

  it('refuses a malformed tool definition', async () => {
    const response = await post({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'no_parameters' } }],
    })
    assert.equal(response.status, 400)
    const body = await response.json()
    assert.ok(errorContract.is(body), `error off-contract: ${JSON.stringify(body)}`)
    assert.equal(body.error.type, 'invalid_request_error')
  })
})

describe('/v1/realtime', () => {
  it('streams partials and a final, and survives bad input', async () => {
    const socket = await TestSocket.connect(`${host.wsBase}/v1/realtime`)

    socket.send({ type: 'input_audio_buffer.append', audio: chunkOfMs(1000, 16000) })
    const partial = await socket.next()
    assert.ok(realtimeServerEventContract.is(partial))
    assert.deepEqual(partial, { type: 'transcription.partial', text: 'heard 1000ms' })

    // invalid envelope: error event, session untouched
    socket.send({ type: 'input_audio_buffer.append', audio: { mediaType: 'audio/ogg' } })
    const error = await socket.next()
    assert.ok(realtimeServerEventContract.is(error))
    assert.equal(error.type, 'error')
    assert.equal(error.type === 'error' && error.error.type, 'invalid_request_error')

    socket.send({ type: 'input_audio_buffer.append', audio: chunkOfMs(500, 16000) })
    const second = await socket.next()
    assert.deepEqual(second, { type: 'transcription.partial', text: 'heard 1500ms' })

    socket.send({ type: 'input_audio_buffer.commit' })
    const done = await socket.next()
    assert.ok(realtimeServerEventContract.is(done))
    assert.deepEqual(done, { type: 'transcription.completed', text: 'heard 1500ms total' })
    socket.close()
  })
})
