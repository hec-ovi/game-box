/**
 * The provider registry over real HTTP: what a settings screen reads, what it
 * writes, what it is told about a provider, and where a job ends up.
 *
 * These point the two configuration files at a temporary directory through the
 * environment, which is process-wide, so they live in their own file.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import {
  providerHealthContract,
  providerModelsContract,
  providerTestContract,
  configurationViewContract,
  type ConfigurationView,
  type Provider,
  type Routes,
} from '../src/providers/schema.ts'
import { startHost, type RunningHost } from './support/host.ts'
import { startUpstream, type RunningUpstream } from './support/upstream.ts'

const KEY = 'sk-test-notarealkey-0001'
const SECOND_KEY = 'sk-test-notarealkey-0002'

const ANSWER = [
  '{"choices":[{"index":0,"delta":{"content":"Halveston."},"finish_reason":null}]}',
  '{"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
]

let host: RunningHost
let stub: RunningUpstream
let workspace: string
let configFile: string
let secretsFile: string

/** The stub standing in for a hosted service, and a local server nothing listens on. */
function hosted(): Provider {
  return { id: 'hosted', kind: 'external', label: 'Hosted', base: stub.base, model: 'stub-small', secretName: 'STUB_API_KEY' }
}
function silent(): Provider {
  return { id: 'silent', kind: 'local', label: 'Silent', host: '127.0.0.1', port: 1, model: 'default' }
}

before(async () => {
  stub = await startUpstream(ANSWER)
  workspace = mkdtempSync(join(tmpdir(), 'game-box-providers-'))
  configFile = join(workspace, '.game-box.json')
  secretsFile = join(workspace, '.env.local')
  process.env.GAME_BOX_CONFIG_FILE = configFile
  process.env.GAME_BOX_SECRETS_FILE = secretsFile
  delete process.env.GAME_BOX_LLM_UPSTREAM
  delete process.env.OPENROUTER_API_KEY
  delete process.env.STUB_API_KEY
  host = await startHost()
})

after(async () => {
  delete process.env.GAME_BOX_CONFIG_FILE
  delete process.env.GAME_BOX_SECRETS_FILE
  await host.close()
  await stub.close()
  rmSync(workspace, { recursive: true, force: true })
})

function read(): Promise<Response> {
  return fetch(`${host.base}/v1/providers`)
}

function write(body: unknown): Promise<Response> {
  return fetch(`${host.base}/v1/providers`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function probe(id: string, leaf: 'health' | 'models'): Promise<Response> {
  return fetch(`${host.base}/v1/providers/${id}/${leaf}`)
}

/** The shape a provider writes a key back in when it complains about it. */
function masked(key: string): string {
  return `${key.slice(0, 8)}${'*'.repeat(12)}${key.slice(-4)}`
}

function chat(body: unknown): Promise<Response> {
  return fetch(`${host.base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Put the registry in a known state, and hand back what it now reads as. */
async function configure(providers: readonly unknown[], routes: Routes): Promise<ConfigurationView> {
  const response = await write({ providers, routes })
  const text = await response.text()
  assert.equal(response.status, 200, text)
  const body: unknown = JSON.parse(text)
  assert.ok(configurationViewContract.is(body), `off-contract: ${text}`)
  return body
}

describe('GET /v1/providers', () => {
  it('answers one of each family before anything is saved, with neither key nor route', async () => {
    const response = await read()
    assert.equal(response.status, 200)

    const body = await response.json()
    assert.ok(configurationViewContract.is(body), `off-contract: ${JSON.stringify(body)}`)
    assert.deepEqual(
      body.providers.map((provider) => [provider.id, provider.kind]),
      [
        ['openrouter', 'external'],
        ['local', 'local'],
      ],
    )
    const openrouter = body.providers[0]
    assert.equal(openrouter?.kind === 'external' && openrouter.secretSet, false)
    assert.equal(openrouter?.configured, false, 'a hosted provider with no key is not ready for a job')
    assert.deepEqual(body.routes, {})
  })
})

describe('PUT /v1/providers', () => {
  it('stores the key where only the owner can read it, and the rest where nobody minds', async () => {
    const view = await configure([{ ...hosted(), secret: KEY }, silent()], { city: 'hosted' })

    const stored = view.providers[0]
    assert.equal(stored?.kind === 'external' && stored.secretSet, true)
    assert.equal(stored?.configured, true)
    assert.deepEqual(view.routes, { city: 'hosted' })

    assert.match(readFileSync(secretsFile, 'utf8'), new RegExp(`^STUB_API_KEY=${KEY}$`, 'm'))
    assert.equal(statSync(secretsFile).mode & 0o777, 0o600, 'a key file the whole machine can read is a leaked key')
    assert.ok(!readFileSync(configFile, 'utf8').includes(KEY), 'the key must not be in the file that is not for keys')
  })

  it('never hands the key back, on the way out or on the way in again', async () => {
    const saved = await (await write({ providers: [{ ...hosted(), secret: KEY }] })).text()
    const listed = await (await read()).text()

    assert.ok(!saved.includes(KEY), saved)
    assert.ok(!listed.includes(KEY), listed)
  })

  it('keeps the stored key when the body leaves it out, and clears it on an empty one', async () => {
    await configure([{ ...hosted(), secret: SECOND_KEY }], {})

    const kept = await configure([hosted()], {})
    assert.equal(kept.providers[0]?.kind === 'external' && kept.providers[0].secretSet, true)
    assert.match(readFileSync(secretsFile, 'utf8'), new RegExp(`^STUB_API_KEY=${SECOND_KEY}$`, 'm'))

    const cleared = await configure([{ ...hosted(), secret: '' }], {})
    assert.equal(cleared.providers[0]?.kind === 'external' && cleared.providers[0].secretSet, false)
    assert.ok(!readFileSync(secretsFile, 'utf8').includes('STUB_API_KEY'))
  })

  it('refuses a routing that points nowhere, and two providers wearing one id', async () => {
    const dangling = await write({ providers: [hosted()], routes: { quests: 'nobody' } })
    assert.equal(dangling.status, 400)
    assert.match(((await dangling.json()) as { error: { message: string } }).error.message, /routes.quests/)

    const twice = await write({ providers: [hosted(), hosted()], routes: {} })
    assert.equal(twice.status, 400)
  })

  it('refuses a body that is not the configuration', async () => {
    const response = await write({ providers: [{ id: 'x', kind: 'external' }] })
    assert.equal(response.status, 400)
  })
})

describe('asking one provider how it is', () => {
  before(async () => {
    await configure([{ ...hosted(), secret: KEY }, silent(), { ...hosted(), id: 'keyless', secretName: 'ABSENT_KEY' }], {})
  })
  after(() => stub.answerWith(ANSWER))

  it('says ok, and how long it took, when it answers', async () => {
    stub.answerWith(ANSWER)
    const body = await (await probe('hosted', 'health')).json()

    assert.ok(providerHealthContract.is(body), `off-contract: ${JSON.stringify(body)}`)
    assert.equal(body.verdict, 'ok')
    assert.equal(body.secretSet, true)
    assert.equal(body.status, 200)
    assert.ok(body.ms >= 0)
    assert.equal(stub.seen.at(-1)?.url, '/v1/models', 'health costs one cheap listing, never a generation')
  })

  it('tells apart nothing answering, it answering no, it being busy, and it not being set up', async () => {
    const unreachable = await (await probe('silent', 'health')).json()
    assert.ok(providerHealthContract.is(unreachable))
    assert.equal(unreachable.verdict, 'unreachable')
    assert.equal(unreachable.status, null)
    assert.equal(unreachable.secretSet, undefined, 'a local server has no key to be set')

    const misconfigured = await (await probe('keyless', 'health')).json()
    assert.ok(providerHealthContract.is(misconfigured))
    assert.equal(misconfigured.verdict, 'misconfigured')
    assert.equal(misconfigured.secretSet, false)

    stub.refuseWith(401)
    const refused = await (await probe('hosted', 'health')).json()
    assert.ok(providerHealthContract.is(refused))
    assert.equal(refused.verdict, 'refused')
    assert.equal(refused.status, 401)

    stub.refuseWith(429)
    const busy = await (await probe('hosted', 'health')).json()
    assert.ok(providerHealthContract.is(busy))
    assert.equal(busy.verdict, 'busy')
  })

  // A provider can echo the key back part-masked, which still gives away its
  // head and its tail. Relaying that verbatim would leak the key through the
  // one field a settings screen puts on the page.
  it('never relays the key back, even in the half-masked shape a provider writes it in', async () => {
    stub.refuseWith(401, JSON.stringify({ error: { message: `Incorrect API key provided: ${masked(KEY)}.` } }))

    const body = await (await probe('hosted', 'health')).json()

    assert.ok(providerHealthContract.is(body))
    assert.equal(body.verdict, 'refused')
    const detail = body.detail ?? ''
    assert.ok(!detail.includes(KEY.slice(0, 8)), detail)
    assert.ok(detail.includes('Incorrect API key provided'), 'and it still says what the provider said')
  })

  it('lists what it can run, keeping the name where it gave one', async () => {
    stub.answerWith(ANSWER)
    const body = await (await probe('hosted', 'models')).json()

    assert.ok(providerModelsContract.is(body), `off-contract: ${JSON.stringify(body)}`)
    assert.equal(body.verdict, 'ok')
    assert.deepEqual(body.verdict === 'ok' ? body.models : [], [{ id: 'stub-large', label: 'Stub Large' }, { id: 'stub-small' }])
  })

  it('proves it with one real generation, uncapped, and says which model answered', async () => {
    stub.answerWith(ANSWER)
    const response = await fetch(`${host.base}/v1/providers/hosted/test`, { method: 'POST' })
    const body = await response.json()

    assert.ok(providerTestContract.is(body), `off-contract: ${JSON.stringify(body)}`)
    assert.equal(body.verdict, 'ok')
    assert.equal(body.verdict === 'ok' && body.text, 'Hello from the stub.')
    assert.equal(body.verdict === 'ok' && body.model, 'stub-small')

    const sent = stub.seen.at(-1)
    assert.equal(sent?.url, '/v1/chat/completions')
    assert.equal(sent?.body.max_tokens, undefined, 'no output-length cap is ever sent, here as anywhere')
    assert.equal(Array.isArray(sent?.body.messages) && sent.body.messages.length, 1)
  })

  it('is 404 for a provider nobody saved, and 405 for the wrong verb', async () => {
    assert.equal((await probe('ghost', 'health')).status, 404)
    assert.equal((await fetch(`${host.base}/v1/providers/hosted/test`)).status, 405)
  })
})

describe('a job', () => {
  before(async () => {
    await configure([{ ...hosted(), secret: KEY }], { city: 'hosted' })
    stub.answerWith(ANSWER)
  })

  it('goes to the provider it is assigned to, with that provider s model and its key', async () => {
    assert.equal((await chat({ job: 'city', messages: [{ role: 'user', content: 'name it' }] })).status, 200)

    const sent = stub.seen.at(-1)
    assert.equal(sent?.url, '/v1/chat/completions')
    assert.equal(sent?.body.model, 'stub-small')
    assert.equal(sent?.headers.authorization, `Bearer ${KEY}`)
    assert.equal(sent?.body.job, undefined, 'the job is this service s idea, not something an engine is told')
    assert.equal(sent?.headers['x-openrouter-title'], undefined, 'attribution belongs to OpenRouter alone')
  })

  it('nobody is assigned to, and a request that names none, answer the way they did before jobs existed', async () => {
    const before = stub.seen.length

    const unassigned = await (await chat({ job: 'quests', messages: [{ role: 'user', content: 'open the gate' }] })).json()
    const jobless = await (await chat({ messages: [{ role: 'user', content: 'open the gate' }] })).json()

    for (const body of [unassigned, jobless]) {
      assert.equal((body as { choices: { message: { content: string } }[] }).choices[0]?.message.content, 'You said: open the gate')
    }
    assert.equal(stub.seen.length, before, 'an unassigned job must not reach a provider somebody else was given')
  })

  it('is refused as a job at all when it is not one of the five', async () => {
    const response = await chat({ job: 'painting', messages: [{ role: 'user', content: 'hello' }] })
    assert.equal(response.status, 400)
  })
})

describe('a configuration file nobody can read', () => {
  after(async () => {
    await configure([hosted()], {})
  })

  it('is reported by name, and still lets generation happen', async () => {
    writeFileSync(configFile, 'this is not the configuration', 'utf8')

    const response = await read()
    assert.equal(response.status, 500)
    const body = (await response.json()) as { error: { message: string } }
    assert.ok(body.error.message.includes(configFile), body.error.message)

    // A settings file gone wrong must not take the whole service with it.
    const answered = await (await chat({ job: 'city', messages: [{ role: 'user', content: 'open the gate' }] })).json()
    assert.equal((answered as { choices: { message: { content: string } }[] }).choices[0]?.message.content, 'You said: open the gate')
  })

  it('is written straight over by a body that needs nothing from it, and never half over', async () => {
    writeFileSync(configFile, 'this is not the configuration', 'utf8')

    assert.equal((await write({ routes: {} })).status, 500, 'half a body over a file it cannot read would lose the other half')

    const view = await configure([hosted()], {})
    assert.deepEqual(view.providers.map((provider) => provider.id), ['hosted'])
  })
})
