/**
 * The live wiring: the real forge, the real narrator, and every byte that
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
  STOREYS_DEFAULT,
  summarise,
  type ForgeError,
  type Instance,
  type InstanceRequest,
  type Narrator,
  type PlaceRequest,
  type Premise,
  type Unwritten,
  type WorldSummary,
} from '@gb/forge'
import type { History } from '@gb/forge'
import { validateQuest, type QuestProblem } from '@gb/quest'
import { Scribe, type ScribeFailure } from '@gb/scribe'
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

/** A stage that would not write, in the words the page shows. */
export interface Stop {
  readonly stage: string
  /** Where in the build it stopped (`premise`, `charter:jail`, `quest:3`). */
  readonly at: string
  /** Why (`unreachable`, `refused`, `invalid-arguments`). */
  readonly code: string
  /** One sentence: what could not be written, and what the engine said. */
  readonly message: string
}

/**
 * `Unwritten` carries the stage and the sentence. A `@gb/scribe` failure is an
 * `Unwritten` with the call and the code beside them, so both are read off it
 * when the narrator behind the stage is a Scribe.
 */
export function stopOf(error: Unwritten): Stop {
  const failure = error as Partial<ScribeFailure>
  return { stage: error.stage, at: failure.at ?? 'not said', code: failure.code ?? 'not said', message: error.message }
}

/**
 * The narrator every sandbox runs against: the model, through the sidecar. A
 * city is written by a model or it is not written, so this is the only author
 * the page has and no stage falls back to another.
 */
export function narratorFor(form: Form, recorder: Recorder, base: string, signal?: AbortSignal): Narrator {
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
 * It forwards every member the inner narrator has and adds none it does not, so
 * a build through this one asks exactly the questions it asks unwatched. A stage
 * that would not write is passed straight on, so the build stops here exactly
 * where it stops without the page watching.
 */
export function capturing(inner: Narrator, into: Captured, history?: History): Narrator {
  const narrator: Narrator = {
    async nameCity(input) {
      const written = await inner.nameCity(input)
      if (written.ok) into.cityName = written.value
      return written
    },
    namePlace: (input) => inner.namePlace(input),
    describeNpc: (input) => inner.describeNpc(input),
    describeItem: (input) => inner.describeItem(input),
    async writeQuests(input) {
      into.summary = input.summary
      const written = await inner.writeQuests(input)
      if (written.ok) into.quests = written.value
      return written
    },
  }

  if (history || inner.writePremise) {
    narrator.writePremise = async (input) => {
      into.premiseInput = input
      if (history) {
        into.history = history
        return { ok: true, value: history }
      }
      const written = await inner.writePremise!(input)
      if (written.ok) into.history = written.value
      return written
    }
  }
  if (inner.writeInstances) {
    narrator.writeInstances = async (requests) => {
      into.instanceRequests = requests
      const written = await inner.writeInstances!(requests)
      if (written.ok) into.instances = written.value
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
  /** Why the build refused: its code and what it carried. */
  readonly error?: string
  /** The stage that would not write, when that is what refused it. */
  readonly stopped?: Unwritten
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
    const error = `${result.error.code}\n${refusalOf(result.error)}`
    if (result.error.code === 'unwritten') return { captured, error, stopped: result.error, ms }
    return { captured, error, ms }
  }
  captured.world = result.value.world
  return { captured, ms }
}

export interface PlanOutcome {
  readonly world?: World
  /** Why the plan refused: its code and what it carried. */
  readonly error?: string
  readonly ms: number
}

/**
 * The arithmetic half of a town, drawn with no narrator in the room:
 * `Forge.plan` is the code a build lays a town out with, stopped before the
 * writing, so this is the town the brief gives rather than a second guess at it.
 * Nothing in it is named and no door opens, which is the whole of what a page
 * can show for free.
 */
export function planCity(form: Form, history?: History): PlanOutcome {
  const started = performance.now()
  const result = Forge.plan(briefOf(form), history)
  const ms = Math.round(performance.now() - started)
  if (!result.ok) return { error: `${result.error.code}\n${refusalOf(result.error)}`, ms }
  return { world: result.value, ms }
}

/** Why a build refused, in the words of whichever refusal it was. */
function refusalOf(error: ForgeError): string {
  switch (error.code) {
    case 'invalid-brief':
      return error.violations.map((one) => `${one.path}: ${one.message}`).join('\n')
    case 'unsound-world':
      return error.problems.map((one) => `${one.where}: ${one.message}`).join('\n')
    case 'unwritten':
      return `${error.stage}: ${error.message}`
  }
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
