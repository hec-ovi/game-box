import { Sidecar } from '@gb/sidecar'
import Ajv2020 from 'ajv/dist/2020.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'

/** The service's own published request schema, read from its box. */
const chatRequestSchema = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '..', '..', '..', 'host', 'schema', 'api', 'chat-request.json'),
    'utf8',
  ),
)
const validateChatRequest = new Ajv2020({ strict: false }).compile(chatRequestSchema)

export interface Sent {
  readonly toolName: string
  readonly parameters: Record<string, unknown>
  readonly description: string
  readonly user: string
}

export type Reply = unknown | 'no-call' | 'http-500'

/** Answers may be slow, so a test can land them out of the order they were asked in. */
export type Answer = Reply | Promise<Reply>

/** A stand-in model. Every request is checked against the service contract before it is answered. */
export function fakeModel(answer: Reply[] | ((sent: Sent, index: number) => Answer)) {
  const sent: Sent[] = []
  const queue = Array.isArray(answer) ? answer.slice() : undefined
  const fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    expect(
      validateChatRequest(body),
      `request off the service contract: ${JSON.stringify(validateChatRequest.errors)}`,
    ).toBe(true)
    expect(body.max_tokens, 'nothing here may cap how long an answer runs').toBeUndefined()
    for (const message of body.messages) {
      expect(String(message.content), 'a prompt reached the model with a hole still in it').not.toContain('{{')
    }

    const tool = body.tools[0].function
    const call: Sent = {
      toolName: tool.name,
      parameters: tool.parameters,
      description: tool.description,
      user: body.messages[1].content,
    }
    const index = sent.length
    sent.push(call)
    expect(body.tool_choice).toEqual({ type: 'function', function: { name: tool.name } })

    const reply = queue
      ? queue.length > 1
        ? queue.shift()
        : queue[0]
      : await (answer as (sent: Sent, index: number) => Answer)(call, index)
    if (reply === 'http-500') return new Response('engine on fire', { status: 500 })
    if (reply === 'no-call') {
      return Response.json({ choices: [{ message: { role: 'assistant', content: 'here you go' } }] })
    }
    return Response.json({
      choices: [
        {
          message: {
            role: 'assistant',
            tool_calls: [
              { id: 'call_1', type: 'function', function: { name: tool.name, arguments: JSON.stringify(reply) } },
            ],
          },
        },
      ],
    })
  }) as unknown as typeof globalThis.fetch

  return { sent, sidecar: new Sidecar({ base: 'http://127.0.0.1:8976', fetch }) }
}
