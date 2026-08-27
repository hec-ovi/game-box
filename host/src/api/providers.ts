/**
 * The provider endpoints: read the whole configuration, write it, and ask one
 * provider whether it is there, whether it answers, and what it can run.
 *
 * Reading and writing the configuration succeed or fail as HTTP. The three
 * probes always answer 200 carrying a verdict, because their whole job is to
 * report which state a provider is in.
 */
import { violationText } from '../contract.ts'
import { Providers, type Environment, type ProvidersError } from '../providers/index.ts'
import type { Contract } from '../contract.ts'
import {
  configurationViewContract,
  providerHealthContract,
  providerModelsContract,
  providerTestContract,
} from '../providers/schema.ts'
import { errorBody } from './errors.ts'

export const PROVIDERS_PATH = '/v1/providers'

export interface ApiResult {
  readonly status: number
  readonly body: unknown
}

const PROBES = ['health', 'test', 'models'] as const

export type Probe = (typeof PROBES)[number]

export interface ProviderRoute {
  readonly id: string
  readonly probe: Probe
}

/** `/v1/providers/{id}/health`, `/test` or `/models`, and nothing else. */
export function providerRoute(path: string): ProviderRoute | undefined {
  if (!path.startsWith(`${PROVIDERS_PATH}/`)) return undefined
  const parts = path.slice(PROVIDERS_PATH.length + 1).split('/')
  const [id, probe] = parts
  if (parts.length !== 2 || id === undefined || probe === undefined) return undefined
  return PROBES.includes(probe as Probe) ? { id: decodeURIComponent(id), probe: probe as Probe } : undefined
}

/** `GET /v1/providers`. Which providers exist, which are ready, where jobs go. */
export function configuration(env: Environment): ApiResult {
  const read = new Providers(env).configuration()
  return read.ok ? sealed(configurationViewContract, read.value) : failure(read.error)
}

/** `PUT /v1/providers`. Answers with the configuration as it now stands. */
export function save(env: Environment, rawBody: string): ApiResult {
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return refuse(400, 'body is not valid JSON')
  }
  const written = new Providers(env).save(body)
  return written.ok ? sealed(configurationViewContract, written.value) : failure(written.error)
}

export async function probe(env: Environment, route: ProviderRoute, gone?: AbortSignal): Promise<ApiResult> {
  const providers = new Providers(env)
  if (route.probe === 'health') return answer(providerHealthContract, await providers.health(route.id, gone))
  if (route.probe === 'test') return answer(providerTestContract, await providers.test(route.id, gone))
  return answer(providerModelsContract, await providers.models(route.id, gone))
}

function answer<T>(shape: Contract<T>, result: { ok: true; value: T } | { ok: false; error: ProvidersError }): ApiResult {
  return result.ok ? sealed(shape, result.value) : failure(result.error)
}

/**
 * Nothing leaves without fitting the schema it is published under. The
 * configuration schema has no field a key could sit in, so a key cannot ride
 * out of here even by accident.
 */
function sealed<T>(shape: Contract<T>, value: T): ApiResult {
  const checked = shape.parse(value)
  if (checked.ok) return { status: 200, body: checked.value }
  return { status: 500, body: errorBody(`${shape.name} came out off-contract: ${violationText(checked.error)}`, 'server_error') }
}

function failure(error: ProvidersError): ApiResult {
  switch (error.code) {
    case 'invalid-config':
      return refuse(400, error.message)
    case 'no-such-provider':
      return refuse(404, error.message)
    case 'unreadable':
    case 'unwritable':
      return { status: 500, body: errorBody(error.message, 'server_error') }
  }
}

function refuse(status: number, message: string): ApiResult {
  return { status, body: errorBody(message, 'invalid_request_error') }
}
