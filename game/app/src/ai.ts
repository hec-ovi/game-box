import type { AiView, HudIntent } from '@gb/hud'
import { editable, Providers, type Configuration, type JobId, type Local, type ProviderEdit, type ProvidersError, type Save } from '@gb/providers'
import { aiView, type Probed } from './ai-view.ts'

/** The six things a settings screen can do about the AI, whichever screen it is. */
export type AiIntent = Extract<HudIntent, { kind: `ai-${string}` }>

/**
 * Which AI runs which job, for both settings screens at once.
 *
 * The service is where this lives: it holds the providers, the keys and the
 * routing, so whichever screen saves, the other reads the same thing back.
 * Nothing about a provider is kept in the browser, and a key typed on either
 * screen goes straight out and is never held here.
 *
 * Health and a real test both take their time, so a provider is marked as
 * being checked while one is in flight and carries what came back once it
 * lands. Every save goes out in order, so two fields typed quickly cannot
 * overwrite each other.
 */
export class Ai {
  #client: Providers
  #say: (line: string) => void
  #watchers = new Set<() => void>()
  #configuration: Configuration | undefined
  #probed = new Map<string, Probed>()
  #trouble: string | undefined
  #queue: Promise<unknown> = Promise.resolve()

  constructor(input: { client?: Providers; say?: (line: string) => void } = {}) {
    this.#client = input.client ?? new Providers()
    this.#say = input.say ?? (() => {})
  }

  /**
   * Told whenever any of this moved, so every screen showing it redraws. Both
   * the launcher and the interface in game watch the one instance, which is
   * why a provider set up at the front door is already set up in the tab.
   */
  onChange(watcher: () => void): () => void {
    this.#watchers.add(watcher)
    return () => void this.#watchers.delete(watcher)
  }

  #changed(): void {
    for (const watcher of this.#watchers) watcher()
  }

  /** What both settings screens draw. Nothing until the service has answered once. */
  view(): AiView | undefined {
    return this.#configuration ? aiView(this.#configuration, this.#probed) : undefined
  }

  /** Why there is nothing to show, when there is nothing to show. */
  get trouble(): string | undefined {
    return this.#configuration ? undefined : this.#trouble
  }

  /** Read how the providers stand. Called once when the page opens, and after every save. */
  async load(): Promise<void> {
    const read = await this.#client.configuration()
    if (read.ok) {
      this.#configuration = read.value
      this.#trouble = undefined
    } else {
      this.#trouble = `${this.#client.base} did not answer, so there is nothing to set up here yet (${plainly(read.error)}).`
    }
    this.#changed()
  }

  /** One of the six, from either screen. Anything else is not this box's. */
  handle(intent: HudIntent): boolean {
    switch (intent.kind) {
      case 'ai-model':
        this.#write(intent.providerId, (edit) => ({ ...edit, model: intent.model.trim() }))
        return true
      case 'ai-detail':
        this.#write(intent.providerId, (edit) => addressed(edit, intent.detail))
        return true
      // the key never comes back here and is never kept: it goes out on this
      // call and whether one is stored is read off the next answer
      case 'ai-key':
        this.#write(intent.providerId, (edit) => (edit.kind === 'external' ? { ...edit, secret: intent.secret } : undefined))
        return true
      case 'ai-health':
        this.#probe(intent.providerId, 'check')
        return true
      case 'ai-test':
        this.#probe(intent.providerId, 'test')
        return true
      case 'ai-job':
        this.#route(intent.jobId, intent.providerId)
        return true
      default:
        return false
    }
  }

  /** A field on one provider, with the rest of the configuration sent back as it stands. */
  #write(providerId: string, change: (edit: ProviderEdit) => ProviderEdit | undefined): void {
    this.#save((configuration) => {
      const { providers, routes } = editable(configuration)
      const standing = providers.find((one) => one.id === providerId)
      const changed = standing && change(standing)
      if (!changed) return undefined
      return { providers: providers.map((one) => (one.id === providerId ? changed : one)), routes }
    })
  }

  /** A job pointed at a provider. The whole routing goes back, because that is how it is written. */
  #route(jobId: JobId, providerId: string): void {
    this.#save((configuration) => {
      const { providers, routes } = editable(configuration)
      return { providers, routes: { ...routes, [jobId]: providerId } }
    })
  }

  #save(build: (configuration: Configuration) => Save | undefined): void {
    this.#queue = this.#queue.then(async () => {
      const configuration = this.#configuration
      if (!configuration) return
      const edit = build(configuration)
      if (!edit) return
      const written = await this.#client.save(edit)
      if (written.ok) this.#configuration = written.value
      else this.#say(`That setting would not save: ${plainly(written.error)}`)
      this.#changed()
    })
  }

  /**
   * Ask a provider something and draw the wait. A check is one listing call
   * and brings back what it can run; a test is one real generation and brings
   * back what the model wrote.
   */
  #probe(providerId: string, kind: 'check' | 'test'): void {
    if (!this.#configuration?.providers.some((one) => one.id === providerId)) return
    if (this.#probed.get(providerId)?.checking) return
    this.#mark(providerId, { checking: true, ...(kind === 'test' ? {} : { note: undefined }) })
    void (kind === 'check' ? this.#check(providerId) : this.#test(providerId))
  }

  async #check(providerId: string): Promise<void> {
    const asked = await this.#client.health(providerId)
    if (!asked.ok) {
      this.#mark(providerId, { checking: false, answered: false, note: plainly(asked.error) })
      return
    }
    const answered = asked.value.verdict === 'ok'
    this.#mark(providerId, {
      checking: false,
      answered,
      ...(answered ? { note: undefined } : { note: asked.value.detail ?? saidAbout(asked.value.verdict) }),
    })
    // one press asks both questions: whether it answers, and what it can run
    if (!answered) return
    const listed = await this.#client.models(providerId)
    if (listed.ok && listed.value.verdict === 'ok') this.#mark(providerId, { models: listed.value.models.map((one) => one.id) })
  }

  async #test(providerId: string): Promise<void> {
    const called = await this.#client.test(providerId)
    if (!called.ok) {
      this.#mark(providerId, { checking: false, tested: { error: plainly(called.error) } })
      return
    }
    // why it failed is drawn under the row as the last call; saying it again
    // as the note would be the same sentence twice
    const answer = called.value
    this.#mark(providerId, {
      checking: false,
      answered: answer.verdict === 'ok',
      note: undefined,
      tested: answer.verdict === 'ok' ? { ms: answer.ms, reply: answer.text } : { error: answer.detail },
    })
  }

  #mark(providerId: string, moved: Probed): void {
    this.#probed.set(providerId, { ...this.#probed.get(providerId), ...moved })
    this.#changed()
  }
}

/** Where a local server is, typed as one line: a machine, and a port after it. */
function addressed(edit: ProviderEdit, detail: string): ProviderEdit {
  if (edit.kind === 'external') return { ...edit, base: detail.trim() }
  const bare = detail.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '')
  const mark = bare.lastIndexOf(':')
  const port = mark > 0 ? Number(bare.slice(mark + 1)) : Number.NaN
  const named: Pick<Local, 'host' | 'port'> =
    Number.isInteger(port) && port >= 1 && port <= 65535 ? { host: bare.slice(0, mark), port } : { host: bare, port: edit.port }
  return { ...edit, ...named }
}

/** One line for a screen, out of whatever came back instead of an answer. */
function plainly(error: ProvidersError): string {
  switch (error.code) {
    case 'unreachable':
      return 'nothing answered'
    case 'refused':
      return error.message || `it answered ${error.status}`
    case 'no-such-provider':
      return 'that provider is not there any more'
    case 'off-contract':
      return 'the answer was not one this game can read'
    case 'timeout':
      return `nothing came back in ${Math.round(error.ms / 1000)} s`
    case 'aborted':
      return 'the call was stopped'
  }
}

/** A verdict with no line of its own, in words. */
function saidAbout(verdict: string): string {
  if (verdict === 'busy') return 'It is rate-limited right now. Try again in a moment.'
  if (verdict === 'misconfigured') return 'It has not been set up far enough to answer.'
  if (verdict === 'refused') return 'It answered no, which is a wrong key or a model this account may not use.'
  return 'Nothing answered.'
}
