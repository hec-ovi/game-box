import { contract } from '@gb/kit'
import { z } from 'zod'

/**
 * The shapes the AI service publishes for its provider endpoints, as this box
 * reads them. Every reply is checked against one of these before it leaves the
 * client, so nothing downstream reads a field the service did not send.
 *
 * Unknown fields are dropped rather than refused: a newer service may add one,
 * and this box hands on only what it declares. That is also the second lock on
 * a key, after the service's own: a `secret` that somehow appeared in a reply
 * would be stripped here before any caller could read it.
 */

const Id = z.string().min(1)

/** The five things a model is asked to write. */
export const JOBS = ['history', 'city', 'places', 'quests', 'dialogs'] as const

export type JobId = (typeof JOBS)[number]

/** Which job goes to which provider. A job with no entry is unassigned. */
const RoutesSchema = z.object({
  history: Id.optional(),
  city: Id.optional(),
  places: Id.optional(),
  quests: Id.optional(),
  dialogs: Id.optional(),
})

export type Routes = z.infer<typeof RoutesSchema>

/** A hosted service reached with a key. The key itself lives on the service and is never here. */
const ExternalSchema = z.object({
  id: Id,
  kind: z.literal('external'),
  label: z.string(),
  base: z.string(),
  model: z.string(),
  secretName: z.string(),
  secretSet: z.boolean(),
  configured: z.boolean(),
})

/** An OpenAI-compatible server of your own. It is never sent a credential. */
const LocalSchema = z.object({
  id: Id,
  kind: z.literal('local'),
  label: z.string(),
  host: z.string(),
  port: z.number().int(),
  model: z.string(),
  configured: z.boolean(),
})

const ProviderSchema = z.discriminatedUnion('kind', [ExternalSchema, LocalSchema])

export type External = z.infer<typeof ExternalSchema>
export type Local = z.infer<typeof LocalSchema>
export type Provider = z.infer<typeof ProviderSchema>

const ConfigurationSchema = z.object({
  providers: z.array(ProviderSchema),
  routes: RoutesSchema,
})

export type Configuration = z.infer<typeof ConfigurationSchema>

/**
 * What a probe came back with. `ok`: it answered. `unreachable`: nothing
 * answered. `refused`: it answered no, which is a wrong key or a model the
 * account may not use. `busy`: rate-limited. `misconfigured`: it was never
 * asked, because its settings are incomplete.
 */
const VerdictSchema = z.enum(['ok', 'unreachable', 'refused', 'busy', 'misconfigured'])

export type Verdict = z.infer<typeof VerdictSchema>

const HealthSchema = z.object({
  id: Id,
  verdict: VerdictSchema,
  secretSet: z.boolean().optional(),
  status: z.number().int().nullable(),
  ms: z.number().int(),
  detail: z.string().optional(),
})

export type Health = z.infer<typeof HealthSchema>

const TestedSchema = z.union([
  z.object({ id: Id, verdict: z.literal('ok'), ms: z.number().int(), text: z.string(), model: z.string() }),
  z.object({ id: Id, verdict: VerdictSchema.exclude(['ok']), ms: z.number().int(), detail: z.string() }),
])

export type Tested = z.infer<typeof TestedSchema>

const ModelsSchema = z.union([
  z.object({
    id: Id,
    verdict: z.literal('ok'),
    ms: z.number().int(),
    models: z.array(z.object({ id: z.string().min(1), label: z.string().min(1).optional() })),
  }),
  z.object({ id: Id, verdict: VerdictSchema.exclude(['ok']), ms: z.number().int(), detail: z.string() }),
])

export type Models = z.infer<typeof ModelsSchema>

export const configurationContract = contract('providers-configuration', ConfigurationSchema)
export const healthContract = contract('provider-health', HealthSchema)
export const testedContract = contract('provider-test', TestedSchema)
export const modelsContract = contract('provider-models', ModelsSchema)

/**
 * One provider as it goes back to the service. It carries no `secretSet` and
 * no `configured`, because both are the service's reading of the rest; an
 * external one may carry `secret`, which goes one way only.
 */
export type ProviderEdit =
  | {
      readonly id: string
      readonly kind: 'external'
      readonly label: string
      readonly base: string
      readonly model: string
      readonly secretName: string
      /** Left out keeps the stored key; an empty string clears it. */
      readonly secret?: string
    }
  | {
      readonly id: string
      readonly kind: 'local'
      readonly label: string
      readonly host: string
      readonly port: number
      readonly model: string
    }

/** What a save writes. Each half replaces the whole of its side; leaving one out leaves it alone. */
export interface Save {
  readonly providers?: readonly ProviderEdit[]
  readonly routes?: Routes
}

/**
 * The configuration read back as a body to write: the same providers with the
 * service's own readings taken off, so a caller changes one field and sends
 * the lot. It never carries a key, because none was ever read.
 */
export function editable(configuration: Configuration): { providers: ProviderEdit[]; routes: Routes } {
  return {
    providers: configuration.providers.map((provider) =>
      provider.kind === 'external'
        ? {
            id: provider.id,
            kind: 'external',
            label: provider.label,
            base: provider.base,
            model: provider.model,
            secretName: provider.secretName,
          }
        : { id: provider.id, kind: 'local', label: provider.label, host: provider.host, port: provider.port, model: provider.model },
    ),
    routes: { ...configuration.routes },
  }
}
