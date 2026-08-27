import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { editable, Providers, type Configuration, type Save } from '../src/index.ts'

/** The service's own published save shape, read from the service that serves it. */
const validateSave = new Ajv2020({ strict: false }).compile(
  JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', '..', 'host', 'schema', 'api', 'providers-save.json'), 'utf8')),
)

interface Call {
  url: string
  method: string
  body: unknown
}

/** A service that answers whatever the test says, and keeps every call it was sent. */
function serviceOver(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetch = (async (url: string, init: RequestInit) => {
    const call: Call = { url, method: init.method ?? 'GET', body: init.body === undefined ? undefined : JSON.parse(String(init.body)) }
    calls.push(call)
    return answer(call)
  }) as unknown as typeof globalThis.fetch
  return { calls, providers: new Providers({ base: 'http://127.0.0.1:8976', fetch }) }
}

const CONFIGURATION: Configuration = {
  providers: [
    {
      id: 'openrouter',
      kind: 'external',
      label: 'OpenRouter',
      base: 'https://openrouter.ai/api/v1',
      model: 'google/gemma-4-31b-it:free',
      secretName: 'OPENROUTER_API_KEY',
      secretSet: false,
      configured: true,
    },
    { id: 'local', kind: 'local', label: 'Local server', host: '127.0.0.1', port: 8080, model: 'default', configured: true },
  ],
  routes: { quests: 'openrouter' },
}

describe('reading and writing how the providers are set up', () => {
  it('reads the whole configuration off the service', async () => {
    const { calls, providers } = serviceOver(() => Response.json(CONFIGURATION))

    const read = await providers.configuration()

    expect(read).toEqual({ ok: true, value: CONFIGURATION })
    expect(calls[0]).toMatchObject({ url: 'http://127.0.0.1:8976/v1/providers', method: 'GET' })
  })

  it('writes providers and routing in the shape the service publishes, and reads back what stands', async () => {
    const { calls, providers } = serviceOver(() => Response.json(CONFIGURATION))
    const edit: Save = { ...editable(CONFIGURATION), routes: { quests: 'openrouter', dialogs: 'local' } }

    const written = await providers.save(edit)

    expect(written).toEqual({ ok: true, value: CONFIGURATION })
    expect(calls[0]).toMatchObject({ url: 'http://127.0.0.1:8976/v1/providers', method: 'PUT' })
    expect(validateSave(calls[0]!.body), `body off the api contract: ${JSON.stringify(validateSave.errors)}`).toBe(true)
  })

  it('carries a key out and never lets one back in', async () => {
    // the service answers with a key in it, which it never does: the client
    // still hands back a value that cannot hold one
    const { calls, providers } = serviceOver(() =>
      Response.json({
        ...CONFIGURATION,
        providers: CONFIGURATION.providers.map((one) => ({ ...one, secret: 'sk-live-do-not-read-me' })),
      }),
    )
    const edit = editable(CONFIGURATION)

    const written = await providers.save({
      providers: edit.providers.map((one) => (one.id === 'openrouter' ? { ...one, secret: 'sk-live-do-not-read-me' } : one)),
    })

    expect(JSON.stringify(calls[0]!.body)).toContain('sk-live-do-not-read-me')
    expect(validateSave(calls[0]!.body), `body off the api contract: ${JSON.stringify(validateSave.errors)}`).toBe(true)
    expect(written.ok).toBe(true)
    expect(JSON.stringify(written)).not.toContain('sk-live')
    // and nothing a caller could read the configuration back through carries one either
    expect(JSON.stringify(editable(CONFIGURATION))).not.toContain('sk-live')
  })
})

describe('asking one provider', () => {
  it('asks whether it answers, without generating anything', async () => {
    const { calls, providers } = serviceOver(() => Response.json({ id: 'openrouter', verdict: 'ok', secretSet: true, status: 200, ms: 313 }))

    const health = await providers.health('openrouter')

    expect(health).toEqual({ ok: true, value: { id: 'openrouter', verdict: 'ok', secretSet: true, status: 200, ms: 313 } })
    expect(calls[0]).toMatchObject({ url: 'http://127.0.0.1:8976/v1/providers/openrouter/health', method: 'GET' })
  })

  it('makes one real call and hands back what the model wrote', async () => {
    const { calls, providers } = serviceOver(() =>
      Response.json({ id: 'openrouter', verdict: 'ok', ms: 2110, text: 'Hello.', model: 'google/gemma-4-31b-it:free' }),
    )

    const tested = await providers.test('openrouter')

    expect(tested).toEqual({
      ok: true,
      value: { id: 'openrouter', verdict: 'ok', ms: 2110, text: 'Hello.', model: 'google/gemma-4-31b-it:free' },
    })
    expect(calls[0]).toMatchObject({ url: 'http://127.0.0.1:8976/v1/providers/openrouter/test', method: 'POST' })
  })

  it('reads a bad verdict as an answer, not as a failure', async () => {
    const { providers } = serviceOver(() => Response.json({ id: 'local', verdict: 'unreachable', ms: 12, detail: 'nothing on 127.0.0.1:8080' }))

    const tested = await providers.test('local')

    expect(tested).toEqual({ ok: true, value: { id: 'local', verdict: 'unreachable', ms: 12, detail: 'nothing on 127.0.0.1:8080' } })
  })

  it('lists what a provider offers', async () => {
    const { calls, providers } = serviceOver(() =>
      Response.json({ id: 'openrouter', verdict: 'ok', ms: 240, models: [{ id: 'a/one', label: 'One' }, { id: 'a/two' }] }),
    )

    const models = await providers.models('openrouter')

    expect(models).toEqual({ ok: true, value: { id: 'openrouter', verdict: 'ok', ms: 240, models: [{ id: 'a/one', label: 'One' }, { id: 'a/two' }] } })
    expect(calls[0]).toMatchObject({ url: 'http://127.0.0.1:8976/v1/providers/openrouter/models', method: 'GET' })
  })
})

describe('what comes back instead of an answer', () => {
  it('reports a service nothing is listening on', async () => {
    const providers = new Providers({
      base: 'http://127.0.0.1:1',
      fetch: (() => Promise.reject(new Error('connection refused'))) as unknown as typeof globalThis.fetch,
    })

    expect(await providers.configuration()).toMatchObject({ ok: false, error: { code: 'unreachable' } })
  })

  it('reports a configuration the service will not take, in its own words', async () => {
    const { providers } = serviceOver(() =>
      Response.json({ error: { message: 'quests is pointed at "nobody", which is not in this body', type: 'invalid_request_error' } }, { status: 400 }),
    )

    expect(await providers.save({ routes: { quests: 'nobody' } })).toMatchObject({
      ok: false,
      error: { code: 'refused', status: 400, message: 'quests is pointed at "nobody", which is not in this body' },
    })
  })

  it('reports a provider that is not there', async () => {
    const { providers } = serviceOver(() => Response.json({ error: { message: 'no provider "ghost"', type: 'invalid_request_error' } }, { status: 404 }))

    expect(await providers.health('ghost')).toMatchObject({ ok: false, error: { code: 'no-such-provider', message: 'no provider "ghost"' } })
  })

  it('refuses an answer that does not fit the shape it is published under', async () => {
    const { providers } = serviceOver(() => Response.json({ providers: [{ id: 'openrouter', kind: 'external' }], routes: {} }))

    const read = await providers.configuration()

    expect(read.ok).toBe(false)
    if (read.ok) throw new Error('expected off-contract')
    expect(read.error.code).toBe('off-contract')
    if (read.error.code !== 'off-contract') throw new Error('expected off-contract')
    expect(read.error.violations.length).toBeGreaterThan(0)
  })

  it('gives up on a service that never answers, and says how long it waited', async () => {
    const { providers } = serviceOver(
      (call) =>
        new Promise<Response>((_, reject) => {
          // never answers: only the client's own clock ends this call
          void call
          setTimeout(() => reject(new Error('aborted')), 200)
        }),
    )

    expect(await providers.configuration({ timeoutMs: 20 })).toMatchObject({ ok: false, error: { code: 'timeout', ms: 20 } })
  })

  it('tells a caller who walked away apart from a service that is down', async () => {
    const stop = new AbortController()
    const { providers } = serviceOver(() => {
      stop.abort()
      return Promise.reject(new Error('aborted'))
    })

    expect(await providers.test('openrouter', { signal: stop.signal })).toMatchObject({ ok: false, error: { code: 'aborted' } })
    expect(await providers.test('openrouter', { signal: stop.signal })).toMatchObject({ ok: false, error: { code: 'aborted' } })
  })
})
