// @vitest-environment jsdom
import type { Hud, HudPatch, Notice } from '@gb/hud'
import { PlayerState } from '@gb/play'
import { Providers } from '@gb/providers'
import { QuestLog } from '@gb/quest'
import { World } from '@gb/world'
import { screen, waitFor, within } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { Ai } from '../src/ai.ts'
import { Boot } from '../src/boot/boot.ts'
import { Library, MemoryShelf } from '../src/boot/library.ts'
import { Panel } from '../src/boot/panel.ts'
import { Conditions } from '../src/conditions.ts'
import { Intents } from '../src/intents.ts'
import { Reporting } from '../src/reporting.ts'

const PAGE = ['index.html', 'game/app/index.html'].map((path) => resolve(process.cwd(), path)).find(existsSync)!

/** The panel exactly as the page serves it, script tag and all removed. */
function servePage(): void {
  const page = readFileSync(PAGE, 'utf8')
  const body = /<body>([\s\S]*)<\/body>/.exec(page)![1]!
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '')
}

const KEY = 'sk-or-v1-never-write-this-down'

/**
 * The AI service, as far as these two screens can tell: it holds the
 * providers, the key and the routing, answers the three probes, and never
 * hands a key back to anybody.
 */
function service(options: { hold?: boolean } = {}) {
  const sent: Array<{ method: string; path: string; body?: Record<string, unknown> }> = []
  let stored: string | undefined
  let held: (() => void) | undefined
  const configuration = {
    providers: [
      {
        id: 'openrouter',
        kind: 'external' as const,
        label: 'OpenRouter',
        base: 'https://openrouter.ai/api/v1',
        model: 'google/gemma-4-31b-it:free',
        secretName: 'OPENROUTER_API_KEY',
        secretSet: false,
        configured: true,
      },
      { id: 'local', kind: 'local' as const, label: 'Local server', host: '127.0.0.1', port: 8080, model: 'default', configured: true },
    ],
    routes: {} as Record<string, string>,
  }

  const fetch = (async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname
    const body = init.body === undefined ? undefined : (JSON.parse(String(init.body)) as Record<string, unknown>)
    sent.push({ method: init.method ?? 'GET', path, ...(body ? { body } : {}) })

    if (path === '/v1/providers' && (init.method ?? 'GET') === 'GET') return Response.json(configuration)
    if (path === '/v1/providers') {
      const providers = body?.providers as Array<Record<string, unknown>> | undefined
      for (const one of providers ?? []) {
        if (typeof one.secret === 'string') stored = one.secret
        const standing = configuration.providers.find((was) => was.id === one.id)
        if (!standing) continue
        Object.assign(standing, { ...one, secret: undefined })
        delete (standing as Record<string, unknown>).secret
        if (standing.kind === 'external') standing.secretSet = stored !== undefined && stored !== ''
      }
      if (body?.routes) configuration.routes = { ...(body.routes as Record<string, string>) }
      return Response.json(configuration)
    }
    if (path.endsWith('/health')) {
      if (options.hold) await new Promise<void>((resolve_) => void (held = resolve_))
      return Response.json({ id: 'openrouter', verdict: 'ok', secretSet: stored !== undefined, status: 200, ms: 313 })
    }
    if (path.endsWith('/models')) {
      return Response.json({ id: 'openrouter', verdict: 'ok', ms: 240, models: [{ id: 'a/one' }, { id: 'a/two' }] })
    }
    return Response.json({ id: 'openrouter', verdict: 'ok', ms: 2110, text: 'Hello.', model: 'a/one' })
  }) as unknown as typeof globalThis.fetch

  return {
    sent,
    configuration,
    /** What the service is holding, which is the only place a key ever lands. */
    get stored() {
      return stored
    },
    /** Let the held probe answer. */
    answer: () => held?.(),
    ai: (say?: (line: string) => void) => new Ai({ client: new Providers({ base: 'http://127.0.0.1:8976', fetch }), ...(say ? { say } : {}) }),
    fetch,
  }
}

/** The interface, as a list of everything it was pushed. */
function screenful() {
  const pushed: HudPatch[] = []
  const announced: Notice[] = []
  const hud = { show: (patch: HudPatch) => void pushed.push(patch), announce: (notice: Notice) => void announced.push(notice) } as unknown as Hud
  return { pushed, announced, hud }
}

/** The game's own half: what the settings tab is pushed, and what it reports back. */
function inGame(ai: Ai) {
  const { pushed, announced, hud } = screenful()
  const world = World.create({ name: 'Anchorage', theme: 'plain', seed: 'ai', width: 24, height: 14 })
  const player = PlayerState.create(world.id, 0)
  const log = QuestLog.create([], player)
  const report = new Reporting({ world, log, player, hud, conditions: new Conditions(player.clock), ai })
  ai.onChange(() => report.refresh())
  const intents = new Intents({
    log,
    hud,
    ai,
    talking: {} as never,
    report,
    body: { setTyping: () => {} } as never,
    chart: {} as never,
    conditions: new Conditions(player.clock),
    machines: {} as never,
    counters: {} as never,
    travel: {} as never,
    leave: () => {},
    releasePointer: () => {},
  })
  return { pushed, announced, report, intents }
}

/** The last thing the settings tab was told about which AI runs which job. */
function lastAi(pushed: HudPatch[]) {
  return pushed.filter((patch) => patch.settings).at(-1)!.settings!.ai
}

describe('the settings tab in game', () => {
  it('draws nothing about the AI until the service has answered, then draws every provider and all five jobs', async () => {
    const host = service()
    const ai = host.ai()
    const { pushed, report } = inGame(ai)

    report.refresh()
    expect(lastAi(pushed)).toBeUndefined()

    await ai.load()

    const view = lastAi(pushed)!
    expect(view.providers.map((one) => [one.id, one.family, one.detail, one.needsKey, one.health])).toEqual([
      ['openrouter', 'external', 'https://openrouter.ai/api/v1', true, 'unknown'],
      ['local', 'local', '127.0.0.1:8080', false, 'unknown'],
    ])
    expect(view.jobs.map((one) => one.id)).toEqual(['history', 'city', 'places', 'quests', 'dialogs'])
    expect(view.jobs.every((one) => one.label.length > 0 && one.providerId === undefined)).toBe(true)
  })

  it('says it is checking while the service is still asking, and what came back when it lands', async () => {
    const host = service({ hold: true })
    const ai = host.ai()
    const { pushed, intents } = inGame(ai)
    await ai.load()

    intents.handle({ kind: 'ai-health', providerId: 'openrouter' })
    expect(lastAi(pushed)!.providers[0]!.health).toBe('checking')

    host.answer()
    await waitFor(() => expect(lastAi(pushed)!.providers[0]!.health).toBe('ok'))
    // one press asks both questions, so the model becomes a list to pick from
    await waitFor(() => expect(lastAi(pushed)!.providers[0]!.models).toEqual(['a/one', 'a/two']))
  })

  it('makes one real call and pushes what the model wrote back to the tab', async () => {
    const host = service()
    const ai = host.ai()
    const { pushed, intents } = inGame(ai)
    await ai.load()

    intents.handle({ kind: 'ai-test', providerId: 'openrouter' })
    await waitFor(() => expect(lastAi(pushed)!.providers[0]!.tested).toEqual({ ms: 2110, reply: 'Hello.' }))
    expect(host.sent.at(-1)).toMatchObject({ method: 'POST', path: '/v1/providers/openrouter/test' })
  })

  it('sends a key typed in game straight to the service and keeps none of it', async () => {
    const host = service()
    const ai = host.ai()
    const { pushed, intents } = inGame(ai)
    await ai.load()
    expect(lastAi(pushed)!.providers[0]!.needsKey).toBe(true)

    intents.handle({ kind: 'ai-key', providerId: 'openrouter', secret: KEY })

    await waitFor(() => expect(host.stored).toBe(KEY))
    await waitFor(() => expect(lastAi(pushed)!.providers[0]!.needsKey).toBe(false))
    // it went out on that one call and nowhere else: nothing pushed to the
    // interface carries it, and nothing in this browser holds it
    expect(JSON.stringify(pushed)).not.toContain(KEY)
    expect(JSON.stringify(localStorage)).not.toContain(KEY)
    expect(document.body.innerHTML).not.toContain(KEY)
  })

  it('writes a model, an address and a job through, and reads back what the service made of them', async () => {
    const host = service()
    const ai = host.ai()
    const { pushed, intents } = inGame(ai)
    await ai.load()

    intents.handle({ kind: 'ai-model', providerId: 'openrouter', model: 'a/two' })
    await waitFor(() => expect(lastAi(pushed)!.providers[0]!.model).toBe('a/two'))

    // a local server is one line to type and two fields to the service
    intents.handle({ kind: 'ai-detail', providerId: 'local', detail: 'host.docker.internal:11434' })
    await waitFor(() => expect(lastAi(pushed)!.providers[1]!.detail).toBe('host.docker.internal:11434'))
    expect(host.configuration.providers[1]).toMatchObject({ host: 'host.docker.internal', port: 11434 })

    intents.handle({ kind: 'ai-job', jobId: 'quests', providerId: 'openrouter' })
    await waitFor(() => expect(lastAi(pushed)!.jobs.find((one) => one.id === 'quests')!.providerId).toBe('openrouter'))
    expect(host.configuration.routes).toEqual({ quests: 'openrouter' })
  })

  it('says so where the player is standing when a setting will not save', async () => {
    const said: string[] = []
    // reads once, then the service will not take a write
    let read = false
    const fetch = (async (_url: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') === 'GET') {
        read = true
        return Response.json({ providers: [{ id: 'local', kind: 'local', label: 'Local server', host: '127.0.0.1', port: 8080, model: 'default', configured: true }], routes: {} })
      }
      return Response.json({ error: { message: 'the settings file cannot be written', type: 'server_error' } }, { status: 500 })
    }) as unknown as typeof globalThis.fetch
    const ai = new Ai({ client: new Providers({ base: 'http://127.0.0.1:8976', fetch }), say: (line) => said.push(line) })
    const { intents } = inGame(ai)
    await ai.load()
    expect(read).toBe(true)

    intents.handle({ kind: 'ai-job', jobId: 'city', providerId: 'local' })

    await waitFor(() => expect(said).toEqual(['That setting would not save: the settings file cannot be written']))
  })
})

describe('the settings screen in the launcher', () => {
  beforeEach(() => {
    servePage()
    localStorage.clear()
  })

  async function launcher(host: ReturnType<typeof service>) {
    const panel = new Panel(document.querySelector<HTMLElement>('#boot')!)
    const boot = new Boot({
      mount: document.createElement('div'),
      panel,
      library: new Library(new MemoryShelf()),
      providers: { base: 'http://127.0.0.1:8976', fetch: host.fetch },
      start: () => Promise.reject(new Error('no game in this test')),
      art: () => Promise.reject(new Error('no art in this test')),
    })
    await boot.start(new URLSearchParams())
    // an empty shelf lands on the form; the settings action is on the landing
    panel.face = 'home'
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^settings$/i }))
    await waitFor(() => expect(screen.getByText('google/gemma-4-31b-it:free')).toBeTruthy())
    return { user, panel, boot }
  }

  it('offers the same two groups as the tab in game, with what each provider needs and what it is waiting on', async () => {
    const host = service()
    await launcher(host)

    expect(screen.getByText('Providers')).toBeTruthy()
    expect(screen.getByText('Which AI does what')).toBeTruthy()
    // a provider with no key says what it is waiting on rather than sitting blank
    expect(screen.getByText('No key stored for this one yet.')).toBeTruthy()
    expect(screen.getByDisplayValue('https://openrouter.ai/api/v1')).toBeTruthy()
    expect(screen.getByDisplayValue('127.0.0.1:8080')).toBeTruthy()
    // and the five jobs, each saying it is pointed at nothing yet
    expect(screen.getAllByText('Nothing assigned yet, so the game answers this one its own way.')).toHaveLength(5)
    // the televisions are still here, on the same screen
    expect(screen.getByLabelText(/video on the screens/i)).toBeTruthy()
  })

  it('checks a provider, tests it for real, and shows what came back', async () => {
    const host = service()
    const { user } = await launcher(host)

    await user.click(screen.getByRole('button', { name: /check openrouter/i }))
    await waitFor(() => expect(screen.getByText('Answering')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: /test openrouter/i }))
    await waitFor(() => expect(screen.getByText('Answered in 2110 ms')).toBeTruthy())
    expect(screen.getByText('Hello.')).toBeTruthy()
  })

  it('sends a key typed at the front door straight to the service and keeps none of it', async () => {
    const host = service()
    const { user } = await launcher(host)

    const row = within(screen.getByText('google/gemma-4-31b-it:free').closest('.gb-set-provider')!)
    const box = row.getByLabelText('Key') as HTMLInputElement
    await user.type(box, KEY)
    await user.click(row.getByRole('button', { name: /store key/i }))

    await waitFor(() => expect(host.stored).toBe(KEY))
    // the box empties on the same tick it reports, and nothing on the page or
    // in this browser has a copy
    expect(box.value).toBe('')
    await waitFor(() => expect(screen.getByText('A key is stored for this one.')).toBeTruthy())
    expect(document.body.innerHTML).not.toContain(KEY)
    expect(JSON.stringify(localStorage)).not.toContain(KEY)
    expect(JSON.stringify(host.configuration)).not.toContain(KEY)
  })

  it('points a job at a provider, and the settings tab in game is pushed the same thing', async () => {
    const host = service()
    const { user, boot } = await launcher(host)
    void boot

    const quests = screen.getByLabelText('Quests') as HTMLSelectElement
    await user.selectOptions(quests, 'openrouter')

    await waitFor(() => expect(host.configuration.routes).toEqual({ quests: 'openrouter' }))
    await waitFor(() => expect(within(quests.closest('.gb-set-job')!).getByText(/OpenRouter · /)).toBeTruthy())

    // the service is where this lives, so a screen reading it again reads the
    // same thing: what was set at the front door is set in the game
    const other = host.ai()
    const { pushed } = inGame(other)
    await other.load()
    expect(lastAi(pushed)!.jobs.find((one) => one.id === 'quests')!.providerId).toBe('openrouter')
  })

  it('says why there is nothing when the service does not answer, instead of an empty screen', async () => {
    const panel = new Panel(document.querySelector<HTMLElement>('#boot')!)
    const boot = new Boot({
      mount: document.createElement('div'),
      panel,
      library: new Library(new MemoryShelf()),
      providers: { base: 'http://127.0.0.1:1', fetch: () => Promise.reject(new Error('nothing listening')) },
      start: () => Promise.reject(new Error('no game in this test')),
      art: () => Promise.reject(new Error('no art in this test')),
    })
    await boot.start(new URLSearchParams())
    panel.face = 'home'
    await userEvent.setup().click(screen.getByRole('button', { name: /^settings$/i }))

    await waitFor(() => expect(screen.getByText(/did not answer, so there is nothing to set up here yet/i)).toBeTruthy())
  })
})
