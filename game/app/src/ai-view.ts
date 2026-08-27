import type { AiJob, AiJobId, AiProvider, AiTest, AiView } from '@gb/hud'
import { JOBS, type Configuration, type Provider } from '@gb/providers'

/** What each of the five jobs writes, in the player's words. Both settings screens read these. */
const JOB_LABEL: Record<AiJobId, string> = {
  history: 'City history and charters',
  city: 'Names, signs and districts',
  places: 'Interiors, people and things',
  quests: 'Quests',
  dialogs: 'Talking in game',
}

/** What the game has found out about one provider since the configuration was read. */
export interface Probed {
  /** A check or a test is in flight. */
  readonly checking?: boolean | undefined
  /** How the last check went. Nothing means it has not been checked. */
  readonly answered?: boolean | undefined
  /** Why the last check went badly, in the service's own line. */
  readonly note?: string | undefined
  /** What it listed the last time it was asked. */
  readonly models?: readonly string[] | undefined
  readonly tested?: AiTest | undefined
}

/**
 * The configuration as both settings screens read it: the providers with what
 * the game has since found out about each, and the five jobs with whatever
 * each is pointed at. Nothing here decides anything; it is one shape built
 * from what the service said and what the last probe came back with.
 */
export function aiView(configuration: Configuration, probed: ReadonlyMap<string, Probed>): AiView {
  return {
    providers: configuration.providers.map((provider) => shown(provider, probed.get(provider.id) ?? {})),
    jobs: JOBS.map((id) => job(id, configuration.routes[id])),
  }
}

/** Where a provider is, as one line: an address for a hosted one, a machine and a port for your own. */
export function addressOf(provider: Provider): string {
  return provider.kind === 'external' ? provider.base : `${provider.host}:${provider.port}`
}

function shown(provider: Provider, probed: Probed): AiProvider {
  return {
    id: provider.id,
    family: provider.kind,
    label: provider.label,
    model: provider.model,
    ...(probed.models?.length ? { models: probed.models } : {}),
    detail: addressOf(provider),
    configured: provider.configured,
    needsKey: provider.kind === 'external' && !provider.secretSet,
    health: probed.checking ? 'checking' : probed.answered === undefined ? 'unknown' : probed.answered ? 'ok' : 'failed',
    ...(probed.note ? { note: probed.note } : {}),
    ...(probed.tested ? { tested: probed.tested } : {}),
  }
}

function job(id: AiJobId, providerId: string | undefined): AiJob {
  return { id, label: JOB_LABEL[id], ...(providerId ? { providerId } : {}) }
}
