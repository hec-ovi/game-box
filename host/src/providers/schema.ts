import { z } from 'zod'
import { contract } from '../contract.ts'

/** The five kinds of work a request can be, each routable to its own provider. */
export const JOBS = ['history', 'city', 'places', 'quests', 'dialogs'] as const

const JOB_DESCRIPTION =
  'Which work this request is: history (the city history and its charters), city (names, signs, districts), places (interiors, people, things), quests, dialogs (talking to people in game).'

export const JobSchema = z.enum(JOBS).meta({ description: JOB_DESCRIPTION })

const IdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/)
const LabelSchema = z.string().min(1).max(64)
const ModelSchema = z.string().min(1).max(128)
const SecretNameSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{0,63}$/)
  .meta({ description: 'Which environment-format name in the secrets file holds this key.' })

/** A hosted OpenAI-compatible service reached over the internet with a key. */
const ExternalSchema = z.strictObject({
  id: IdSchema,
  kind: z.literal('external'),
  label: LabelSchema,
  base: z.url(),
  model: ModelSchema,
  secretName: SecretNameSchema,
})

/** An OpenAI-compatible server on this machine or this network, called without auth. */
const LocalSchema = z.strictObject({
  id: IdSchema,
  kind: z.literal('local'),
  label: LabelSchema,
  host: z
    .string()
    .max(255)
    .regex(/^(\[[0-9a-fA-F:]+\]|[A-Za-z0-9._-]+)$/)
    .meta({ description: 'A hostname or address, with no scheme and no port: the port is its own field.' }),
  port: z.int().min(1).max(65535),
  model: ModelSchema,
})

export const ProviderSchema = z.discriminatedUnion('kind', [ExternalSchema, LocalSchema])

/** A job with no entry here goes wherever `GAME_BOX_LLM_UPSTREAM` points. */
export const RoutesSchema = z.strictObject({
  history: IdSchema.optional(),
  city: IdSchema.optional(),
  places: IdSchema.optional(),
  quests: IdSchema.optional(),
  dialogs: IdSchema.optional(),
})

export const ConfigurationSchema = z
  .strictObject({ providers: z.array(ProviderSchema).max(16), routes: RoutesSchema })
  .meta({
    $id: 'game-box.dev/providers/configuration',
    title: 'the stored provider configuration file (no secrets)',
  })

const CONFIGURED_DESCRIPTION = 'Everything this provider needs is set, so a job can be pointed at it.'
const SECRET_SET_DESCRIPTION = 'Whether a key is stored or exported for this provider. The key itself never leaves the host.'

const ProviderViewSchema = z.discriminatedUnion('kind', [
  ExternalSchema.extend({
    secretSet: z.boolean().meta({ description: SECRET_SET_DESCRIPTION }),
    configured: z.boolean().meta({ description: CONFIGURED_DESCRIPTION }),
  }),
  LocalSchema.extend({ configured: z.boolean().meta({ description: CONFIGURED_DESCRIPTION }) }),
])

export const ConfigurationViewSchema = z
  .strictObject({ providers: z.array(ProviderViewSchema), routes: RoutesSchema })
  .meta({
    $id: 'game-box.dev/api/providers-config',
    title: 'the whole provider configuration as a caller sees it',
  })

const SECRET_DESCRIPTION = 'The key to store. Leave it out to keep the stored one; send an empty string to clear it.'

const SaveProviderSchema = z.discriminatedUnion('kind', [
  ExternalSchema.extend({
    secret: z
      .string()
      .max(512)
      .regex(/^[^\n\r]*$/)
      .meta({ description: SECRET_DESCRIPTION })
      .optional(),
  }),
  LocalSchema,
])

export const SaveSchema = z
  .strictObject({ providers: z.array(SaveProviderSchema).max(16).optional(), routes: RoutesSchema.optional() })
  .meta({
    $id: 'game-box.dev/api/providers-save',
    title: 'PUT /v1/providers request: the whole list, the whole routing, or either on its own',
  })

const VERDICT_DESCRIPTION =
  'ok: it answered. unreachable: nothing answered. refused: it answered no. busy: rate-limited, not now. misconfigured: it was never asked, the settings are incomplete.'

export const VerdictSchema = z.enum(['ok', 'unreachable', 'refused', 'busy', 'misconfigured'])
const FailedVerdictSchema = z.enum(['unreachable', 'refused', 'busy', 'misconfigured'])

export const ProviderHealthSchema = z
  .strictObject({
    id: IdSchema,
    verdict: VerdictSchema.meta({ description: VERDICT_DESCRIPTION }),
    secretSet: z.boolean().meta({ description: SECRET_SET_DESCRIPTION }).optional(),
    status: z.int().min(100).max(599).nullable().meta({ description: 'The HTTP status it answered with, null when nothing did.' }),
    ms: z.int().min(0),
    detail: z.string().min(1).optional(),
  })
  .meta({ $id: 'game-box.dev/api/provider-health', title: 'GET /v1/providers/{id}/health response' })

export const ProviderTestSchema = z
  .union([
    z.strictObject({
      id: IdSchema,
      verdict: z.literal('ok'),
      ms: z.int().min(0),
      text: z.string().meta({ description: 'What the model wrote.' }),
      model: z.string().min(1).meta({ description: 'The model that answered, as the provider named it.' }),
    }),
    z.strictObject({
      id: IdSchema,
      verdict: FailedVerdictSchema.meta({ description: VERDICT_DESCRIPTION }),
      ms: z.int().min(0),
      detail: z.string().min(1),
    }),
  ])
  .meta({ $id: 'game-box.dev/api/provider-test', title: 'POST /v1/providers/{id}/test response' })

export const ProviderModelsSchema = z
  .union([
    z.strictObject({
      id: IdSchema,
      verdict: z.literal('ok'),
      ms: z.int().min(0),
      models: z.array(z.strictObject({ id: z.string().min(1), label: z.string().min(1).optional() })),
    }),
    z.strictObject({
      id: IdSchema,
      verdict: FailedVerdictSchema.meta({ description: VERDICT_DESCRIPTION }),
      ms: z.int().min(0),
      detail: z.string().min(1),
    }),
  ])
  .meta({ $id: 'game-box.dev/api/provider-models', title: 'GET /v1/providers/{id}/models response' })

export const configurationContract = contract('configuration', ConfigurationSchema)
export const configurationViewContract = contract('providers-config', ConfigurationViewSchema)
export const saveContract = contract('providers-save', SaveSchema)
export const providerHealthContract = contract('provider-health', ProviderHealthSchema)
export const providerTestContract = contract('provider-test', ProviderTestSchema)
export const providerModelsContract = contract('provider-models', ProviderModelsSchema)

export type Job = z.infer<typeof JobSchema>
export type Provider = z.infer<typeof ProviderSchema>
export type Routes = z.infer<typeof RoutesSchema>
export type Configuration = z.infer<typeof ConfigurationSchema>
export type ConfigurationView = z.infer<typeof ConfigurationViewSchema>
export type SaveRequest = z.infer<typeof SaveSchema>
export type SaveProvider = z.infer<typeof SaveProviderSchema>
export type Verdict = z.infer<typeof VerdictSchema>
export type FailedVerdict = z.infer<typeof FailedVerdictSchema>
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>
export type ProviderTest = z.infer<typeof ProviderTestSchema>
export type ProviderModels = z.infer<typeof ProviderModelsSchema>
