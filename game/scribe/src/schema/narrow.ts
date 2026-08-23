import type { JsonSchema } from './compact.ts'

/** The step kinds the flow check refuses to let dangle: every one of them has to lead somewhere. */
const MUST_LEAD_ON = new Set(['talk', 'goto', 'collect', 'deliver', 'escort', 'join', 'any-of'])

/** The step kinds that end a quest: the flow check refuses a `next` on either of them. */
const ENDS_IT = new Set(['complete', 'fail'])

/** What a step decides first, and what it can only fill in once the rest is settled. */
const FIRST = ['kind', 'id', 'objective']
const LAST = ['next', 'markerLabel', 'hint', 'requires', 'effects', 'optional', 'hidden']

/**
 * Narrows the quest draft schema to what a model can get right, because the
 * schema is what it decodes against and a rule that lives only in the prompt is
 * a rule it can walk past. Everything the narrowed schema still allows, the full
 * draft contract accepts.
 *
 * - **Nothing a `WorldSummary` cannot name.** The summary lists plots, people
 *   and things and has no interior or anchor ids in it, so a `stash` step or a
 *   `goto` into an interior is a step the model can write and nobody can check.
 * - **`next` is required wherever a dead end would be refused, and gone from the
 *   two kinds that end a quest.** Measured: six drafts out of six left `next`
 *   off every step in the middle of the flow, and another put one on a
 *   `complete` step. The prompt asked for both in words.
 * - **Each step in writing order**, because the order properties appear in is
 *   the order a constrained model has to write them in. `kind` goes first, so a
 *   step commits to a mechanic before it writes the sentence the player reads,
 *   and `next` goes after the fields that kind needs rather than before them.
 *   Measured with `next` left where the contract puts it: a step that wrote its
 *   objective before its kind had already skipped a required field, which left
 *   `fail` as the only kind the grammar would still take, and every step of
 *   every draft came out `fail`.
 */
export function narrowToSummary(schema: JsonSchema): JsonSchema {
  const root = structuredClone(schema)
  const steps = (root['properties'] as Record<string, JsonSchema> | undefined)?.['steps']
  const items = steps?.['items'] as JsonSchema | undefined
  const variants = items?.['oneOf']
  if (!Array.isArray(variants)) return root

  items!['oneOf'] = variants
    .filter((variant) => kindOf(variant as JsonSchema) !== 'stash')
    .map((variant) => inWritingOrder(mustLead(plotsOnly(variant as JsonSchema))))
  return root
}

function kindOf(variant: JsonSchema): string | undefined {
  const properties = variant['properties'] as Record<string, JsonSchema> | undefined
  const kind = properties?.['kind']?.['const']
  return typeof kind === 'string' ? kind : undefined
}

/** Leaves `place` with its plot branch only. */
function plotsOnly(variant: JsonSchema): JsonSchema {
  const properties = variant['properties'] as Record<string, JsonSchema> | undefined
  const place = properties?.['place']
  const branches = place?.['anyOf']
  if (!place || !Array.isArray(branches)) return variant

  const plot = branches.find((branch) => 'plotId' in (((branch as JsonSchema)['properties'] as object) ?? {}))
  if (plot) properties!['place'] = plot as JsonSchema
  return variant
}

/** Makes a step in the middle of the flow say where the flow goes next, and one at the end say nothing. */
function mustLead(variant: JsonSchema): JsonSchema {
  const kind = kindOf(variant)
  const properties = variant['properties'] as Record<string, JsonSchema> | undefined
  const required = variant['required']
  if (!kind || !properties || !Array.isArray(required)) return variant

  if (ENDS_IT.has(kind)) {
    delete properties['next']
    return variant
  }
  const next = properties['next']
  if (!next || !MUST_LEAD_ON.has(kind)) return variant

  next['minItems'] = 1
  delete next['default']
  if (!required.includes('next')) required.push('next')
  return variant
}

/** Puts a step's fields in the order the model has to write them in. */
function inWritingOrder(variant: JsonSchema): JsonSchema {
  const properties = variant['properties'] as Record<string, JsonSchema> | undefined
  const required = variant['required']
  if (!properties || !Array.isArray(required)) return variant

  const own = Object.keys(properties).filter((key) => !FIRST.includes(key) && !LAST.includes(key))
  const order = [...FIRST, ...own, ...LAST].filter((key) => key in properties)
  variant['properties'] = Object.fromEntries(order.map((key) => [key, properties[key]]))
  variant['required'] = order.filter((key) => required.includes(key))
  return variant
}
