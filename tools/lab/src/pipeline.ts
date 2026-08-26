/**
 * The live wiring: the real forge, the real narrators, and every byte that
 * passes between them.
 *
 * Nothing here re-implements a stage. A stage's input is whatever `@gb/forge`
 * hands its narrator, taken by wrapping the `Narrator` port and writing down
 * what goes past; a stage's request and reply are whatever the `Sidecar` puts
 * on the wire, taken by handing it a `fetch` of our own. So the page can only
 * ever show what actually happened.
 */
import {
  Forge,
  OfflineNarrator,
  STOREYS_DEFAULT,
  summarise,
  type Instance,
  type InstanceRequest,
  type ItemProfile,
  type Narrator,
  type NpcProfile,
  type PlaceRequest,
  type Premise,
  type WorldSummary,
} from '@gb/forge'
import type { History } from '@gb/forge'
import { validateQuest, type QuestProblem } from '@gb/quest'
import { Scribe } from '@gb/scribe'
import { Sidecar } from '@gb/sidecar'
import { questView, World, type Asks } from '@gb/world'

export const DEFAULT_BASE = 'http://127.0.0.1:8976'

/** One call as it went out and came back, with nothing summarised away. */
export interface Exchange {
  readonly n: number
  readonly tool: string
  readonly url: string
  readonly request: unknown
  readonly status: number
  readonly reply: string
  readonly ms: number
}

/**
 * The `fetch` the sidecar is handed. It keeps the exact body that went out and
 * the exact text that came back, then hands the reply on untouched.
 */
export class Recorder {
  readonly exchanges: Exchange[] = []
  onExchange: (() => void) | undefined

  clear(): void {
    this.exchanges.length = 0
  }

  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const started = performance.now()
    const body = typeof init?.body === 'string' ? init.body : ''
    const response = await globalThis.fetch(input, init)
    const reply = await response.clone().text()
    let request: unknown = body
    try {
      request = JSON.parse(body)
    } catch {
      /* a body that is not JSON is shown as it was sent */
    }
    this.exchanges.push({
      n: this.exchanges.length + 1,
      tool: toolOf(request),
      url: String(typeof input === 'object' && 'url' in input ? input.url : input),
      request,
      status: response.status,
      reply,
      ms: Math.round(performance.now() - started),
    })
    this.onExchange?.()
    return new Response(reply, { status: response.status, statusText: response.statusText, headers: response.headers })
  }
}

function toolOf(request: unknown): string {
  const tools = (request as { tools?: Array<{ function?: { name?: string } }> } | undefined)?.tools
  return tools?.[0]?.function?.name ?? '(no tool)'
}

/** What the owner types into the page, in one place. */
export interface Form {
  theme: string
  seed: string
  brief: string
  tone: string
  mainQuest: string
  sideQuests: string
  blocksX: number
  blocksY: number
  openPlaces: number
  density: number
  maxStoreys: number
  sideQuestCount: number
}

export function defaultForm(): Form {
  return {
    theme: 'neon port city on a dead river',
    seed: 'lab',
    brief: 'A customs house nobody gets past without paying, and a bar where the dockers settle it.',
    tone: '',
    mainQuest: '',
    sideQuests: '',
    blocksX: 2,
    blocksY: 2,
    openPlaces: 3,
    density: 0.8,
    maxStoreys: STOREYS_DEFAULT,
    sideQuestCount: 2,
  }
}

export function asksOf(form: Form): Asks | undefined {
  const asks: Asks = {
    ...(form.tone.trim() ? { tone: form.tone.trim() } : {}),
    ...(form.mainQuest.trim() ? { mainQuest: form.mainQuest.trim() } : {}),
    ...(form.sideQuests.trim() ? { sideQuests: form.sideQuests.trim() } : {}),
  }
  return Object.keys(asks).length ? asks : undefined
}

export function briefOf(form: Form): Record<string, unknown> {
  return {
    theme: form.theme,
    seed: form.seed,
    blocksX: form.blocksX,
    blocksY: form.blocksY,
    openPlaces: form.openPlaces,
    density: form.density,
    maxStoreys: form.maxStoreys,
    ...(form.brief.trim() ? { brief: form.brief.trim() } : {}),
    ...(asksOf(form) ? { asks: asksOf(form) } : {}),
  }
}

/** What the history writer is asked, exactly as `@gb/forge` asks it. */
export function premiseInputOf(form: Form): { theme: string; seed: string; brief?: string; asks?: Asks } {
  const asks = asksOf(form)
  return {
    theme: form.theme,
    seed: form.seed,
    ...(form.brief.trim() ? { brief: form.brief.trim() } : {}),
    ...(asks ? { asks } : {}),
  }
}

/** The two authors a stage can be run against. */
export type Author = 'model' | 'offline'

export function narratorFor(author: Author, form: Form, recorder: Recorder, base: string, signal?: AbortSignal): Narrator {
  if (author === 'offline') return new OfflineNarrator(form.seed)
  const sidecar = new Sidecar({ base, fetch: recorder.fetch })
  return new Scribe({ sidecar, seed: form.seed, concurrency: 1, ...(signal ? { signal } : {}) })
}

/** Every stage's real input and real answer, as they went past the narrator port. */
export interface Captured {
  premiseInput?: { theme: string; seed: string; brief?: string; asks?: Asks }
  history?: History
  cityName?: string
  signRequests?: readonly PlaceRequest[]
  instanceRequests?: readonly InstanceRequest[]
  instances?: readonly Instance[]
  summary?: WorldSummary
  quests?: readonly unknown[]
  world?: World
}

/**
 * The narrator wrapped so the page can see what each stage was handed.
 *
 * It forwards every member the inner narrator has and adds none it does not: an
 * offline narrator has no `namePlaces`, so a build through this one still hangs
 * its signs inside the forge, exactly as it does without the page watching.
 */
export function capturing(inner: Narrator, into: Captured, history?: History): Narrator {
  const narrator: Narrator = {
    async nameCity(input) {
      const name = await inner.nameCity(input)
      into.cityName = name
      return name
    },
    namePlace: (input) => inner.namePlace(input),
    describeNpc: (input): Promise<NpcProfile> => inner.describeNpc(input),
    describeItem: (input): Promise<ItemProfile> => inner.describeItem(input),
    async writeQuests(input) {
      into.summary = input.summary
      const quests = await inner.writeQuests(input)
      into.quests = quests
      return quests
    },
  }

  if (history || inner.writePremise) {
    narrator.writePremise = async (input) => {
      into.premiseInput = input
      const written = history ?? (await inner.writePremise!(input))
      into.history = written
      return written
    }
  }
  if (inner.writeInstances) {
    narrator.writeInstances = async (requests) => {
      into.instanceRequests = requests
      const written = await inner.writeInstances!(requests)
      into.instances = written
      return written
    }
  }
  if (inner.namePlaces) {
    narrator.namePlaces = async (requests) => {
      into.signRequests = requests
      return inner.namePlaces!(requests)
    }
  }
  if (inner.nameDistricts) {
    narrator.nameDistricts = (requests) => inner.nameDistricts!(requests)
  }
  return narrator
}

export interface BuildOutcome {
  readonly captured: Captured
  readonly error?: string
  readonly ms: number
}

/**
 * One real `Forge.build`, watched. This is the only way to get a later stage's
 * true input: the room plan, the posts, the locks and the summary are all made
 * inside the build and published nowhere else.
 */
export async function buildCity(form: Form, author: Narrator, history?: History): Promise<BuildOutcome> {
  const captured: Captured = {}
  const started = performance.now()
  const result = await new Forge(capturing(author, captured, history)).build(briefOf(form))
  const ms = Math.round(performance.now() - started)
  if (!result.ok) {
    const error =
      result.error.code === 'invalid-brief'
        ? result.error.violations.map((v) => `${v.path}: ${v.message}`).join('\n')
        : result.error.problems.map((p) => `${p.where}: ${p.message}`).join('\n')
    return { captured, error: `${result.error.code}\n${error}`, ms }
  }
  captured.world = result.value.world
  return { captured, ms }
}

/** A world file off disk, read through `@gb/world`'s own loader. */
export function openWorld(text: string): { world?: World; error?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    return { error: `not JSON: ${String(cause)}` }
  }
  const doc = (parsed as { world?: unknown }).world ?? parsed
  const loaded = World.load(doc)
  if (loaded.ok) return { world: loaded.value }
  const error = loaded.error
  const detail =
    'violations' in error
      ? error.violations.map((v) => `${v.path}: ${v.message}`).join('\n')
      : 'problems' in error
        ? error.problems.map((p) => `${p.where}: ${p.message}`).join('\n')
        : error.message
  return { error: `${error.code}\n${detail}` }
}

/** A world's own quest input, the way `Forge` builds it. */
export function summaryOf(world: World): WorldSummary {
  const premise: Premise | undefined = world.premise()
  return premise ? summarise(world, premise) : summarise(world)
}

/** What the forge does with a draft: the same check, against the same city. */
export function acceptQuest(world: World, candidate: unknown): { ok: true } | { ok: false; problems: readonly QuestProblem[] } {
  const validated = validateQuest(candidate, questView(world))
  if (validated.ok) return { ok: true }
  return {
    ok: false,
    problems:
      validated.error.code === 'broken-flow'
        ? validated.error.problems
        : validated.error.violations.map((v) => ({ where: v.path, message: v.message })),
  }
}

/** The problems a `Scribe` recorded, when the author was one. */
export function problemsOf(author: Narrator): ReadonlyArray<{ task: string; at: string; error: unknown }> {
  return author instanceof Scribe ? author.problems().map((one) => ({ task: one.task, at: one.at, error: one.error })) : []
}

export async function health(base: string): Promise<string> {
  try {
    const response = await globalThis.fetch(`${base}/health`)
    const body = (await response.json()) as { status?: string; contractVersion?: string }
    return `${base} ${body.status ?? '?'} (contract ${body.contractVersion ?? '?'})`
  } catch (cause) {
    return `${base} unreachable: ${String(cause)}`
  }
}
