/**
 * The provider registry: which engines exist, which are ready, and which job
 * goes to which. Two files behind it, one for the keys and one for everything
 * else, and a key only ever leaves here inside a request to the provider it
 * belongs to.
 */
import type { Upstream } from '../llm/upstream.ts'
import { err, ok, type Result } from '../result.ts'
import { invalidConfig, noSuchProvider, type ProvidersError } from './errors.ts'
import { configPath, secretsPath, type Environment } from './paths.ts'
import { health as probeHealth, models as probeModels, test as probeTest } from './probe.ts'
import { quarrels, secretChanges, withoutSecret } from './save.ts'
import {
  saveContract,
  type Configuration,
  type ConfigurationView,
  type Job,
  type Provider,
  type ProviderHealth,
  type ProviderModels,
  type ProviderTest,
} from './schema.ts'
import { SecretStore } from './secrets.ts'
import { ConfigStore } from './store.ts'
import { reach } from './upstream.ts'

export class Providers {
  readonly #config: ConfigStore
  readonly #secrets: SecretStore

  constructor(env: Environment) {
    this.#config = new ConfigStore(configPath(env))
    this.#secrets = new SecretStore(secretsPath(env), env)
  }

  /** Everything a settings screen needs, and no key: only whether each one is set. */
  configuration(): Result<ConfigurationView, ProvidersError> {
    const stored = this.#config.read()
    return stored.ok ? ok(this.#view(stored.value)) : stored
  }

  /**
   * Save providers, routing, or either on its own. A secret left out of the
   * body keeps the stored one; an empty one clears it. A body that carries
   * both halves can be saved over a configuration file that will not parse.
   */
  save(body: unknown): Result<ConfigurationView, ProvidersError> {
    const parsed = saveContract.parse(body)
    if (!parsed.ok) return err(invalidConfig(parsed.error))

    // A file this service cannot read must not be a dead end. A body carrying
    // both halves keeps nothing from it and goes straight over it; one
    // carrying half is refused, so the other half is not quietly lost.
    const stored = this.#config.read()
    const whole = parsed.value.providers !== undefined && parsed.value.routes !== undefined
    if (!stored.ok && !whole) return stored
    const current = stored.ok ? stored.value : { providers: [], routes: {} }

    const providers = parsed.value.providers?.map(withoutSecret) ?? current.providers
    const routes = parsed.value.routes ?? current.routes
    const violations = quarrels(providers, routes)
    if (violations.length > 0) return err(invalidConfig(violations))

    const written = this.#secrets.write(secretChanges(parsed.value.providers ?? []))
    if (!written.ok) return written
    const saved = this.#config.write({ providers, routes })
    if (!saved.ok) return saved
    return ok(this.#view({ providers, routes }))
  }

  health(id: string, gone?: AbortSignal): Promise<Result<ProviderHealth, ProvidersError>> {
    return this.#probe(id, (provider, secret) => probeHealth(provider, secret, gone))
  }

  test(id: string, gone?: AbortSignal): Promise<Result<ProviderTest, ProvidersError>> {
    return this.#probe(id, (provider, secret) => probeTest(provider, secret, gone))
  }

  models(id: string, gone?: AbortSignal): Promise<Result<ProviderModels, ProvidersError>> {
    return this.#probe(id, (provider, secret) => probeModels(provider, secret, gone))
  }

  /**
   * Where a job goes. `undefined` means nothing is assigned to it, so the
   * caller falls back to whatever the environment points at. A file this
   * service cannot read never stops generation: it answers `undefined` too,
   * and the configuration endpoint is where it is reported.
   */
  upstreamForJob(job: Job): Result<Upstream | undefined, string> {
    const stored = this.#config.read()
    if (!stored.ok) return ok(undefined)
    const id = stored.value.routes[job]
    const provider = id === undefined ? undefined : stored.value.providers.find((entry) => entry.id === id)
    if (provider === undefined) return ok(undefined)
    const reached = reach(provider, this.#secretFor(provider))
    return reached.ok ? ok(reached.value.upstream) : err(reached.error)
  }

  async #probe<T>(id: string, run: (provider: Provider, secret: string | undefined) => Promise<T>): Promise<Result<T, ProvidersError>> {
    const stored = this.#config.read()
    if (!stored.ok) return stored
    const provider = stored.value.providers.find((entry) => entry.id === id)
    if (provider === undefined) return err(noSuchProvider(id))
    return ok(await run(provider, this.#secretFor(provider)))
  }

  #secretFor(provider: Provider): string | undefined {
    return provider.kind === 'external' ? this.#secrets.value(provider.secretName) : undefined
  }

  /**
   * `configured` is the same question the router asks before it sends
   * anything, so a provider that reads as ready here is one a job can be
   * pointed at.
   */
  #view(configuration: Configuration): ConfigurationView {
    return {
      providers: configuration.providers.map((provider) => {
        const secret = this.#secretFor(provider)
        const configured = reach(provider, secret).ok
        return provider.kind === 'external' ? { ...provider, secretSet: secret !== undefined, configured } : { ...provider, configured }
      }),
      routes: configuration.routes,
    }
  }
}

export { configPath, secretsPath, type Environment } from './paths.ts'
export type { ProvidersError } from './errors.ts'
export {
  JOBS,
  JobSchema,
  configurationContract,
  configurationViewContract,
  providerHealthContract,
  providerModelsContract,
  providerTestContract,
  saveContract,
  type Configuration,
  type ConfigurationView,
  type Job,
  type Provider,
  type ProviderHealth,
  type ProviderModels,
  type ProviderTest,
  type Verdict,
} from './schema.ts'
