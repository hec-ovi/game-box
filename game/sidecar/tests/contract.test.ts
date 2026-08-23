import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contract } from '@gb/kit'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Sidecar, type ConverseEvent } from '../src/index.ts'

/** The sidecar's own published request schema, read from the service that serves it. */
const validateChatRequest = new Ajv2020({ strict: false }).compile(
  JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', '..', 'host', 'schema', 'api', 'chat-request.json'), 'utf8')),
)

const Name = contract('name_city', z.object({ name: z.string().min(2) }))

function sidecarOver(handler: (body: Record<string, unknown>) => Response) {
  const seen: Array<Record<string, unknown>> = []
  const fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    expect(validateChatRequest(body), `request off the api contract: ${JSON.stringify(validateChatRequest.errors)}`).toBe(true)
    seen.push(body)
    return handler(body)
  }) as unknown as typeof globalThis.fetch
  return { seen, sidecar: new Sidecar({ base: 'http://127.0.0.1:8976', fetch }) }
}

function toolCallReply(name: string, args: unknown) {
  return Response.json({
    choices: [
      { message: { role: 'assistant', tool_calls: [{ id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } },
    ],
  })
}

function sseReply(chunks: readonly unknown[]) {
  const body = `${chunks.map((c) => `data: ${JSON.stringify(c)}`).join('\n\n')}\n\ndata: [DONE]\n\n`
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
}

function chunk(delta: unknown, finish: string | null = null) {
  return { id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta, finish_reason: finish }] }
}

async function drain(events: AsyncIterable<ConverseEvent>): Promise<ConverseEvent[]> {
  const out: ConverseEvent[] = []
  for await (const event of events) out.push(event)
  return out
}

describe('Sidecar.ask', () => {
  it('forces one tool built from the contract and returns the checked value', async () => {
    const { seen, sidecar } = sidecarOver(() => toolCallReply('name_city', { name: 'Cold Harbour' }))

    const answer = await sidecar.ask(Name, { system: 'be brief', user: 'name a port', toolName: 'name_city', toolDescription: 'name it' })
    expect(answer).toEqual({ ok: true, value: { name: 'Cold Harbour' } })

    const body = seen[0]!
    expect(body.tool_choice).toEqual({ type: 'function', function: { name: 'name_city' } })
    expect((body.tools as Array<{ function: { parameters: unknown } }>)[0]!.function.parameters).toMatchObject({
      type: 'object',
      properties: { name: { type: 'string' } },
    })
  })

  it('reports the four ways a call can fail', async () => {
    const refused = sidecarOver(() => new Response('nope', { status: 503 }))
    expect(await refused.sidecar.ask(Name, ask())).toMatchObject({ ok: false, error: { code: 'refused', status: 503 } })

    const chatty = sidecarOver(() => Response.json({ choices: [{ message: { role: 'assistant', content: 'Cold Harbour!' } }] }))
    expect(await chatty.sidecar.ask(Name, ask())).toMatchObject({ ok: false, error: { code: 'no-tool-call' } })

    const wrong = sidecarOver(() => toolCallReply('name_city', { name: 'x' }))
    const invalid = await wrong.sidecar.ask(Name, ask())
    expect(invalid.ok).toBe(false)
    if (!invalid.ok && invalid.error.code === 'invalid-arguments') {
      expect(invalid.error.violations[0]!.path).toBe('name')
    } else {
      throw new Error('expected invalid-arguments')
    }

    const dead = new Sidecar({
      base: 'http://127.0.0.1:1',
      fetch: (async () => {
        throw new Error('connection refused')
      }) as unknown as typeof globalThis.fetch,
    })
    expect(await dead.ask(Name, ask())).toMatchObject({ ok: false, error: { code: 'unreachable' } })
  })

  function ask() {
    return { system: 's', user: 'u', toolName: 'name_city', toolDescription: 'd' }
  }
})

describe('Sidecar.converse', () => {
  it('streams the reply in pieces and hands back the actions taken', async () => {
    const { seen, sidecar } = sidecarOver(() =>
      sseReply([
        chunk({ content: 'We close ' }),
        chunk({ content: 'at midnight.' }),
        chunk({ tool_calls: [{ id: 'c1', type: 'function', function: { name: 'offer_quest', arguments: '{"questId":"quest_0001"}' } }] }),
        chunk({}, 'tool_calls'),
      ]),
    )

    const stream = await sidecar.converse({
      system: 'you are a bartender',
      messages: [{ role: 'user', content: 'when do you close?' }],
      tools: [{ name: 'offer_quest', description: 'offer a job', parameters: { type: 'object', properties: { questId: { type: 'string' } } } }],
    })
    expect(stream.ok).toBe(true)
    if (!stream.ok) return

    expect(await drain(stream.value)).toEqual([
      { kind: 'text', text: 'We close ' },
      { kind: 'text', text: 'at midnight.' },
      { kind: 'call', name: 'offer_quest', arguments: { questId: 'quest_0001' } },
      { kind: 'end', reason: 'tool_calls' },
    ])

    const body = seen[0]!
    expect(body.stream).toBe(true)
    // the speaker chooses whether to act, so the call is offered, not forced
    expect(body.tool_choice).toBe('auto')
    expect(body.messages).toEqual([
      { role: 'system', content: 'you are a bartender' },
      { role: 'user', content: 'when do you close?' },
    ])
  })

  it('offers no tools when the speaker is allowed to do nothing', async () => {
    const { seen, sidecar } = sidecarOver(() => sseReply([chunk({ content: 'hm.' }), chunk({}, 'stop')]))
    const stream = await sidecar.converse({ system: 's', messages: [{ role: 'user', content: 'hello' }] })
    expect(stream.ok).toBe(true)
    expect(seen[0]!.tools).toBeUndefined()
    expect(seen[0]!.tool_choice).toBeUndefined()
  })

  it('drops a call whose arguments do not parse rather than acting on it', async () => {
    const { sidecar } = sidecarOver(() =>
      sseReply([
        chunk({ tool_calls: [{ id: 'c1', type: 'function', function: { name: 'give_item', arguments: '{"itemId":' } }] }),
        chunk({ content: 'here.' }),
        chunk({}, 'stop'),
      ]),
    )
    const stream = await sidecar.converse({ system: 's', messages: [{ role: 'user', content: 'hi' }] })
    if (!stream.ok) throw new Error('stream did not open')

    const events = await drain(stream.value)
    expect(events.some((e) => e.kind === 'call')).toBe(false)
    expect(events).toContainEqual({ kind: 'text', text: 'here.' })
  })

  it('reports a stream that never opens', async () => {
    const { sidecar } = sidecarOver(() => new Response('down', { status: 502 }))
    const stream = await sidecar.converse({ system: 's', messages: [{ role: 'user', content: 'hi' }] })
    expect(stream).toMatchObject({ ok: false, error: { code: 'refused', status: 502 } })
  })
})
