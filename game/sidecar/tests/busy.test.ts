import { getEventListeners } from 'node:events'
import type { ServerResponse } from 'node:http'
import { contract } from '@gb/kit'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Sidecar, type BusyNotice } from '../src/index.ts'
import { Sse, TestSidecar, wait } from './server.ts'

/**
 * A rate limit is the normal path on a free tier. These prove, on a real
 * socket, that a busy answer is waited out and asked again, that the wait
 * honours what the sidecar asked for and never comes tightly, and that the
 * caller hears `busy` the moment waiting stops being worth it.
 */

const Name = contract('name_city', z.object({ name: z.string().min(2) }))
const ASK = { system: 's', user: 'u', toolName: 'name_city', toolDescription: 'd' }
const ANSWER = { choices: [{ message: { tool_calls: [{ function: { name: 'name_city', arguments: '{"name":"Cold Harbour"}' } }] } }] }

function busy(response: ServerResponse, retryAfter?: number) {
  response.writeHead(429, { 'content-type': 'application/json', ...(retryAfter === undefined ? {} : { 'retry-after': String(retryAfter) }) })
  response.end(JSON.stringify({ error: { message: 'rate limited upstream', type: 'server_error', code: 'model-busy' } }))
}

function answer(response: ServerResponse) {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify(ANSWER))
}

/** Busy for the first `refusals` calls, each with the next `Retry-After` given, then an answer; records when each call landed. */
function busyThenAnswer(refusals: number, ...retryAfter: Array<number | undefined>) {
  const at: number[] = []
  return {
    at,
    serve: (_call: unknown, response: ServerResponse) => {
      at.push(Date.now())
      if (at.length <= refusals) busy(response, retryAfter[at.length - 1])
      else answer(response)
    },
  }
}

describe('a busy model', () => {
  it('is waited out for the seconds it asked, with a share on top, then asked again', async () => {
    const script = busyThenAnswer(1, 1)
    const server = await TestSidecar.start(script.serve)
    try {
      const notices: BusyNotice[] = []
      const sidecar = new Sidecar({ base: server.base, backoff: { jitter: 0.25 }, onBusy: (notice) => notices.push(notice) })
      const result = await sidecar.ask(Name, ASK)

      expect(result).toEqual({ ok: true, value: { name: 'Cold Harbour' } })
      expect(server.calls).toHaveLength(2)
      const gap = script.at[1]! - script.at[0]!
      expect(gap).toBeGreaterThanOrEqual(1000)
      expect(gap).toBeLessThan(1250 + 300)
      expect(notices).toEqual([{ attempt: 1, retryAfter: 1, waitMs: expect.any(Number) }])
      expect(notices[0]!.waitMs).toBeGreaterThanOrEqual(1000)
    } finally {
      await server.stop()
    }
  }, 10_000)

  it('backs off on its own when no wait is named (zero counts as none), doubling each time, and stops after its tries', async () => {
    const script = busyThenAnswer(Infinity, undefined, 0, undefined)
    const server = await TestSidecar.start(script.serve)
    try {
      const sidecar = new Sidecar({ base: server.base, backoff: { attempts: 3, baseMs: 100, jitter: 0 } })
      const result = await sidecar.ask(Name, ASK)

      expect(result).toEqual({ ok: false, error: { code: 'busy', retryAfter: 0.4, message: 'rate limited upstream' } })
      expect(server.calls).toHaveLength(3)
      expect(script.at[1]! - script.at[0]!).toBeGreaterThanOrEqual(100)
      expect(script.at[2]! - script.at[1]!).toBeGreaterThanOrEqual(200)
    } finally {
      await server.stop()
    }
  })

  it('is reported at once when it asks for longer than the box will wait', async () => {
    const script = busyThenAnswer(1, 30)
    const server = await TestSidecar.start(script.serve)
    try {
      const started = Date.now()
      const result = await new Sidecar({ base: server.base, backoff: { capMs: 1000 } }).ask(Name, ASK)
      expect(result).toMatchObject({ ok: false, error: { code: 'busy', retryAfter: 30 } })
      expect(server.calls).toHaveLength(1)
      expect(Date.now() - started).toBeLessThan(500)
    } finally {
      await server.stop()
    }
  })

  it('is reported rather than waited for past the call\'s own clock', async () => {
    const script = busyThenAnswer(1, 2)
    const server = await TestSidecar.start(script.serve)
    try {
      const started = Date.now()
      const result = await new Sidecar({ base: server.base }).ask(Name, { ...ASK, timeoutMs: 500 })
      expect(result).toMatchObject({ ok: false, error: { code: 'busy', retryAfter: 2 } })
      expect(server.calls).toHaveLength(1)
      expect(Date.now() - started).toBeLessThan(400)
    } finally {
      await server.stop()
    }
  })

  it('lets the caller abort the wait, and reports the abort', async () => {
    const script = busyThenAnswer(1, 5)
    const server = await TestSidecar.start(script.serve)
    try {
      const caller = new AbortController()
      const pending = new Sidecar({ base: server.base }).ask(Name, { ...ASK, signal: caller.signal })
      await wait(100)
      caller.abort()
      expect(await pending).toMatchObject({ ok: false, error: { code: 'aborted' } })
      expect(server.calls).toHaveLength(1)
      expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0)
    } finally {
      await server.stop()
    }
  })

  it('holds a streamed reply back the same way', async () => {
    let refused = false
    const server = await TestSidecar.start((_call, response) => {
      if (refused) return void new Sse(response).pump([{ choices: [{ delta: { content: 'hm.' }, finish_reason: 'stop' }] }], 5)
      refused = true
      busy(response, 1)
    })
    try {
      const stream = await new Sidecar({ base: server.base, backoff: { jitter: 0 } }).converse({ system: 's', messages: [{ role: 'user', content: 'hi' }] })
      if (!stream.ok) throw new Error(`the stream did not open: ${stream.error.code}`)
      const events = []
      for await (const event of stream.value) events.push(event)
      expect(events).toEqual([{ kind: 'text', text: 'hm.' }, { kind: 'end', reason: 'stop' }])
      expect(server.calls).toHaveLength(2)
    } finally {
      await server.stop()
    }
  }, 10_000)
})
