import type { Result } from '@gb/kit'
import type { ProvidersError } from './errors.ts'
import {
  configurationContract,
  healthContract,
  modelsContract,
  testedContract,
  type Configuration,
  type Health,
  type Models,
  type Save,
  type Tested,
} from './schema.ts'
import { Wire } from './wire.ts'

const DEFAULT_BASE = 'http://127.0.0.1:8976'

const PATH = '/v1/providers'

/**
 * How long a call may take. Reading, writing and the two cheap probes are one
 * round trip to a service on this machine, plus one to the provider it asks
 * about. A test is a whole generation, which is minutes on a slow model.
 */
export interface Timeouts {
  readonly askMs: number
  readonly testMs: number
}

export const DEFAULT_TIMEOUTS: Timeouts = { askMs: 20_000, testMs: 300_000 }

export interface ProvidersOptions {
  readonly base?: string
  /** Injectable, so this runs in a browser, in Node and in a test. */
  readonly fetch?: typeof fetch
  readonly timeouts?: Partial<Timeouts>
}

/** Every call takes the caller's own signal and may set its own clock. */
export interface Ask {
  readonly signal?: AbortSignal | undefined
  readonly timeoutMs?: number | undefined
}

/**
 * The client for the AI service's provider endpoints: read how the providers
 * are set up, write it back, and ask one of them whether it is there, what it
 * can run, and what it actually answers.
 *
 * A key goes in through `save` and comes back out of nothing. This box never
 * reads one, never keeps one and never puts one in a value it hands back.
 */
export class Providers {
  #wire: Wire
  #timeouts: Timeouts

  constructor(options: ProvidersOptions = {}) {
    this.#wire = new Wire(options.base ?? readEnv('GAME_BOX_URL') ?? DEFAULT_BASE, options.fetch ?? globalThis.fetch.bind(globalThis))
    this.#timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts }
  }

  get base(): string {
    return this.#wire.base
  }

  /** Every provider, whether each is ready for a job, whether each key is set, and the routing. */
  async configuration(ask: Ask = {}): Promise<Result<Configuration, ProvidersError>> {
    return this.#wire.ask(configurationContract, { method: 'GET', path: PATH, ...this.#clock(ask) })
  }

  /**
   * Write the providers, the routing, or both, and read back what now stands.
   * Each half replaces the whole of its side, so send the list as it should
   * be rather than the one row that moved.
   */
  async save(edit: Save, ask: Ask = {}): Promise<Result<Configuration, ProvidersError>> {
    return this.#wire.ask(configurationContract, { method: 'PUT', path: PATH, body: edit, ...this.#clock(ask) })
  }

  /** Does it answer? One listing call, no generation, so it costs nothing to ask often. */
  async health(id: string, ask: Ask = {}): Promise<Result<Health, ProvidersError>> {
    return this.#wire.ask(healthContract, { method: 'GET', path: this.#probe(id, 'health'), ...this.#clock(ask) })
  }

  /** One real call through it: what the model wrote, which model answered, and how long it took. */
  async test(id: string, ask: Ask = {}): Promise<Result<Tested, ProvidersError>> {
    return this.#wire.ask(testedContract, {
      method: 'POST',
      path: this.#probe(id, 'test'),
      ...this.#clock(ask, this.#timeouts.testMs),
    })
  }

  /** What it offers, so a model is picked from a list rather than typed from memory. */
  async models(id: string, ask: Ask = {}): Promise<Result<Models, ProvidersError>> {
    return this.#wire.ask(modelsContract, { method: 'GET', path: this.#probe(id, 'models'), ...this.#clock(ask) })
  }

  #probe(id: string, probe: 'health' | 'test' | 'models'): string {
    return `${PATH}/${encodeURIComponent(id)}/${probe}`
  }

  #clock(ask: Ask, fallback = this.#timeouts.askMs): { ms: number; signal?: AbortSignal } {
    return { ms: ask.timeoutMs ?? fallback, ...(ask.signal ? { signal: ask.signal } : {}) }
  }
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.[name]
}
