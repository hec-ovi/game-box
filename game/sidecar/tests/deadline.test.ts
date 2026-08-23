import { getEventListeners } from 'node:events'
import { contract } from '@gb/kit'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Sidecar, type ConverseEvent } from '../src/index.ts'
import { Sse, TestSidecar, wait } from './server.ts'

/**
 * These run against a real HTTP server on a real socket. A mocked fetch cannot
 * prove any of this: a stall is a socket that stays quiet, and an abort is a
 * connection that gets hung up on.
 */

const Name = contract('name_city', z.object({ name: z.string().min(2) }))
const ASK = { system: 's', user: 'u', toolName: 'name_city', toolDescription: 'd' }

const silence = () => {}
const frame = (text: string) => ({ id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: { content: text } }] })
const finish = { id: 'x', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }

const rejections: unknown[] = []
const collect = (reason: unknown) => rejections.push(reason)
beforeAll(() => process.on('unhandledRejection', collect))
afterAll(() => process.off('unhandledRejection', collect))

describe('a buffered answer', () => {
  it('times out when the sidecar never answers, and says which clock ran out', async () => {
    const server = await TestSidecar.start(silence)
    try {
      const started = Date.now()
      const answer = await new Sidecar({ base: server.base }).ask(Name, { ...ASK, timeoutMs: 150 })
      expect(answer).toMatchObject({ ok: false, error: { code: 'timeout', phase: 'response', ms: 150 } })
      expect(Date.now() - started).toBeLessThan(2000)
    } finally {
      await server.stop()
    }
  })

  it('reports an abort as an abort, never as a timeout', async () => {
    const server = await TestSidecar.start(silence)
    try {
      const caller = new AbortController()
      const answer = new Sidecar({ base: server.base }).ask(Name, { ...ASK, timeoutMs: 60_000, signal: caller.signal })
      await wait(50)
      caller.abort()
      expect(await answer).toMatchObject({ ok: false, error: { code: 'aborted' } })
      expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0)
    } finally {
      await server.stop()
    }
  })

  it('does not even ask when the caller has already given up', async () => {
    const server = await TestSidecar.start(silence)
    try {
      const answer = await new Sidecar({ base: server.base }).ask(Name, { ...ASK, signal: AbortSignal.abort() })
      expect(answer).toMatchObject({ ok: false, error: { code: 'aborted' } })
      expect(server.calls).toHaveLength(0)
    } finally {
      await server.stop()
    }
  })

  it('keeps a dead sidecar apart from a slow one', async () => {
    const server = await TestSidecar.start(silence)
    const base = server.base
    await server.stop()
    expect(await new Sidecar({ base }).ask(Name, { ...ASK, timeoutMs: 5000 })).toMatchObject({
      ok: false,
      error: { code: 'unreachable' },
    })
  })
})

describe('a streamed reply', () => {
  it('gives up on a reply that never starts', async () => {
    const server = await TestSidecar.start((_call, response) => void new Sse(response))
    try {
      const events = await streamed(new Sidecar({ base: server.base }), { firstTokenMs: 150, idleMs: 60_000 })
      expect(events).toEqual([{ kind: 'error', error: { code: 'timeout', phase: 'first-token', ms: 150, message: expect.any(String) } }])
    } finally {
      await server.stop()
    }
  })

  it('gives up on a reply that stops mid-sentence', async () => {
    const server = await TestSidecar.start((_call, response) => {
      const sse = new Sse(response)
      sse.send(frame('We close '))
      sse.send(frame('at '))
    })
    try {
      const events = await streamed(new Sidecar({ base: server.base }), { firstTokenMs: 5000, idleMs: 150 })
      expect(events.slice(0, 2)).toEqual([
        { kind: 'text', text: 'We close ' },
        { kind: 'text', text: 'at ' },
      ])
      expect(events.at(-1)).toMatchObject({ kind: 'error', error: { code: 'timeout', phase: 'token', ms: 150 } })
    } finally {
      await server.stop()
    }
  })

  it('lets a slow but moving reply run past every clock it has', async () => {
    const words = ['one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ']
    const server = await TestSidecar.start((_call, response) => void new Sse(response).pump([...words.map(frame), finish], 60))
    try {
      // 8 pieces 60 ms apart is ~480 ms of reply, well past both 200 ms clocks.
      const started = Date.now()
      const events = await streamed(new Sidecar({ base: server.base }), { firstTokenMs: 200, idleMs: 200 })
      expect(Date.now() - started).toBeGreaterThan(400)
      expect(events.filter((e) => e.kind === 'text').map((e) => (e.kind === 'text' ? e.text : ''))).toEqual(words)
      expect(events.at(-1)).toEqual({ kind: 'end', reason: 'stop' })
      expect(events.some((e) => e.kind === 'error')).toBe(false)
    } finally {
      await server.stop()
    }
  })

  it('stops mid-token when the caller aborts, and hangs up on the sidecar', async () => {
    let open: Sse | undefined
    const server = await TestSidecar.start((_call, response) => {
      open = new Sse(response)
      void open.pump(Array.from({ length: 40 }, (_, i) => frame(`${i} `)), 30)
    })
    try {
      const caller = new AbortController()
      const stream = await new Sidecar({ base: server.base }).converse({
        system: 's',
        messages: [{ role: 'user', content: 'hi' }],
        signal: caller.signal,
        firstTokenMs: 5000,
        idleMs: 5000,
      })
      if (!stream.ok) throw new Error('the stream did not open')

      const events: ConverseEvent[] = []
      for await (const event of stream.value) {
        events.push(event)
        if (events.length === 3) caller.abort()
      }

      expect(events.at(-1)).toMatchObject({ kind: 'error', error: { code: 'aborted' } })
      expect(events.filter((e) => e.kind === 'text').length).toBeLessThan(10)
      await Promise.race([
        server.calls[0]!.closed,
        wait(3000).then(() => Promise.reject(new Error('the sidecar was never hung up on'))),
      ])
      expect(open!.sent).toBeLessThan(40)
      expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0)
    } finally {
      await server.stop()
    }
  })
})

describe('nothing is left behind', () => {
  it('hangs up when the caller walks away from a stream it opened', async () => {
    let open: Sse | undefined
    const server = await TestSidecar.start((_call, response) => {
      open = new Sse(response)
      void open.pump(Array.from({ length: 40 }, (_, i) => frame(`${i} `)), 30)
    })
    try {
      const stream = await new Sidecar({ base: server.base }).converse({
        system: 's',
        messages: [{ role: 'user', content: 'hi' }],
        firstTokenMs: 5000,
        idleMs: 5000,
      })
      if (!stream.ok) throw new Error('the stream did not open')

      let seen = 0
      for await (const _event of stream.value) if (++seen === 3) break

      await Promise.race([
        server.calls[0]!.closed,
        wait(3000).then(() => Promise.reject(new Error('the half-read reply was left open'))),
      ])
      expect(open!.sent).toBeLessThan(40)
    } finally {
      await server.stop()
    }
  })


  it('clears its timer and drops its listener on every call that finishes', async () => {
    const server = await TestSidecar.start((call, response) => {
      if (call.body.stream) return void new Sse(response).pump([frame('hm.'), finish], 5)
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { name: 'name_city', arguments: '{"name":"Cold Harbour"}' } }] } }] }))
    })
    const timers = watchTimers((ms) => ms >= 900_000)
    try {
      const sidecar = new Sidecar({ base: server.base })
      const caller = new AbortController()

      const answer = await sidecar.ask(Name, { ...ASK, timeoutMs: 900_001, signal: caller.signal })
      expect(answer.ok).toBe(true)
      expect(timers.live).toBe(0)

      const events = await streamed(sidecar, { firstTokenMs: 900_002, idleMs: 900_003, signal: caller.signal })
      expect(events.at(-1)).toEqual({ kind: 'end', reason: 'stop' })
      expect(timers.live).toBe(0)
      expect(getEventListeners(caller.signal, 'abort')).toHaveLength(0)
    } finally {
      timers.restore()
      await server.stop()
    }
  })

  it('rejects nothing into the void', async () => {
    await wait(50)
    expect(rejections).toEqual([])
  })
})

async function streamed(
  sidecar: Sidecar,
  clocks: { firstTokenMs: number; idleMs: number; signal?: AbortSignal },
): Promise<ConverseEvent[]> {
  const stream = await sidecar.converse({ system: 's', messages: [{ role: 'user', content: 'hi' }], ...clocks })
  if (!stream.ok) throw new Error(`the stream did not open: ${stream.error.code}`)
  const events: ConverseEvent[] = []
  for await (const event of stream.value) events.push(event)
  return events
}

/**
 * Counts the timers of one unmistakable duration that are still armed. The
 * durations are far longer than any test runs, so only the box's own deadline
 * creates them and only the box's own release can clear them.
 */
function watchTimers(mine: (ms: number) => boolean) {
  const set = globalThis.setTimeout
  const clear = globalThis.clearTimeout
  const live = new Set<unknown>()
  globalThis.setTimeout = ((handler: never, ms?: number, ...rest: never[]) => {
    const id = set(handler, ms, ...rest)
    if (typeof ms === 'number' && mine(ms)) live.add(id)
    return id
  }) as typeof globalThis.setTimeout
  globalThis.clearTimeout = ((id?: never) => {
    live.delete(id)
    clear(id)
  }) as typeof globalThis.clearTimeout
  return {
    get live() {
      return live.size
    },
    restore() {
      globalThis.setTimeout = set
      globalThis.clearTimeout = clear
    },
  }
}
