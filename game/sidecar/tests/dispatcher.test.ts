import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { contract } from '@gb/kit'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { FetchDispatcher } from '../src/dispatcher.ts'
import { Sidecar } from '../src/index.ts'
import { TestSidecar } from './server.ts'

/**
 * Node's fetch has clocks of its own, and until they were pushed out they were
 * the ones that fired: a call over five minutes came back as `unreachable`, so
 * nobody retried it. These prove the box's own deadline is always first.
 */

const Name = contract('name_city', z.object({ name: z.string().min(2) }))
const ASK = { system: 's', user: 'u', toolName: 'name_city', toolDescription: 'd' }
const silence = () => {}

describe('the clocks fetch itself keeps', () => {
  it('outlast the deadline the call runs against', async () => {
    const server = await TestSidecar.start(silence)
    try {
      const { dispatcher } = await new FetchDispatcher().forCall(1500)
      expect(dispatcher, 'no dispatcher was built on Node').toBeDefined()

      const started = Date.now()
      const failed = await fetch(server.base, { dispatcher } as RequestInit).then(
        () => undefined,
        (cause: { cause?: { code?: string } }) => cause.cause?.code,
      )
      const elapsed = Date.now() - started

      // A silent server can only end one way, and it has to end after the box's
      // own 1500 ms clock, never before it.
      expect(failed).toBe('UND_ERR_HEADERS_TIMEOUT')
      expect(elapsed).toBeGreaterThan(2200)
      expect(elapsed).toBeLessThan(8000)
    } finally {
      await server.stop()
    }
  }, 20_000)

  it('are handed to every call the box makes from Node', async () => {
    const seen: Array<{ dispatcher?: unknown }> = []
    const fetch = (async (_url: string, init: { dispatcher?: unknown }) => {
      seen.push(init)
      return Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'name_city', arguments: '{"name":"Cold Harbour"}' } }] } }] })
    }) as unknown as typeof globalThis.fetch

    const answer = await new Sidecar({ base: 'http://127.0.0.1:8976', fetch }).ask(Name, { ...ASK, timeoutMs: 4000 })

    expect(answer.ok).toBe(true)
    expect(seen[0]?.dispatcher).toBeDefined()
  })

  it('are there for the very first call a fresh process makes', () => {
    // Undici only builds its dispatcher once something asks it to, and the first
    // call is the one that waits longest, so this has to hold from cold. Only a
    // process that has fetched nothing yet can show it.
    const entry = `file://${join(import.meta.dirname, '..', 'src', 'dispatcher.ts')}`
    const cold = execFileSync(process.execPath, ['--input-type=module', '-e', [
      `const { FetchDispatcher } = await import('${entry}')`,
      'const { dispatcher } = await new FetchDispatcher().forCall(1000)',
      "process.stdout.write(dispatcher ? 'built' : 'none')",
    ].join('\n')])

    expect(String(cold)).toBe('built')
  })

  it('leave a dispatcher the host application chose alone', async () => {
    // A proxy or a mock is there on purpose. Copying its class and handing the
    // copy to fetch would take these calls out from under it.
    class ProxyAgent {}
    const restore = swapGlobalDispatcher(new ProxyAgent())
    try {
      expect(await new FetchDispatcher().forCall(1000)).toEqual({})
    } finally {
      restore()
    }
  })
})

describe('the browser path', () => {
  it('hands fetch nothing when there is no Node to read it from', async () => {
    const real = globalThis.process
    // Everything a browser lacks: no `process.versions.node`, so no undici.
    const browser = Object.create(real) as NodeJS.Process
    Object.defineProperty(browser, 'versions', { value: {} })
    Object.defineProperty(globalThis, 'process', { value: browser, configurable: true, writable: true })
    try {
      expect(await new FetchDispatcher().forCall(1000)).toEqual({})
    } finally {
      Object.defineProperty(globalThis, 'process', { value: real, configurable: true, writable: true })
    }
  })

  it('has nothing for a bundler to pull in: no undici, no node module', () => {
    const src = join(import.meta.dirname, '..', 'src')
    for (const file of readdirSync(src)) {
      const source = readFileSync(join(src, file), 'utf8')
      expect(source, `${file} imports something a browser cannot load`).not.toMatch(/['"](?:undici|node:[a-z_]+)['"]/)
    }
  })
})

/** Puts a dispatcher of another kind where undici keeps the global one, and hands back the undo. */
function swapGlobalDispatcher(replacement: object): () => void {
  const key = Symbol.for('undici.globalDispatcher.1')
  const scope = globalThis as unknown as Record<symbol, unknown>
  const previous = scope[key]
  scope[key] = replacement
  return () => {
    scope[key] = previous
  }
}
