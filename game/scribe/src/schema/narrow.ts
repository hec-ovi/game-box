import type { JsonSchema } from './compact.ts'

/** The step kinds the flow check refuses to let dangle: every one of them has to lead somewhere. */
const MUST_LEAD_ON = new Set(['talk', 'goto', 'collect', 'deliver', 'escort', 'join', 'any-of'])

/** The step kinds that end a quest: the flow check refuses a `next` on either of them. */
const ENDS_IT = new Set(['complete', 'fail'])

/**
 * Narrows the quest draft schema to what the model can actually get right.
 *
 * Two cuts, both of them narrowings: whatever the model can still produce, the
 * full draft contract accepts.
 *
 * - **Nothing a `WorldSummary` cannot name.** The summary lists plots, people
 *   and things and has no interior or anchor ids in it, so a `stash` step or a
 *   `goto` into an interior is a step the model can write and nobody can check.
 * - **`next` is required wherever a dead end would be refused, and gone from the
 *   two kinds that end a quest.** Measured: six drafts out of six left `next`
 *   off every step in the middle of the flow and were thrown out for it, and
 *   another put one on a `complete` step. The prompt asked for both in words;
 *   the schema is what the model is decoding against.
 *
 * Then each step is put in writing order, because the order properties appear in
 * is the order a model constrained by them has to write them in. `kind` goes
 * first, so the step commits to a mechanic before it writes the sentence the
 * player reads, and `next` goes after the fields that kind needs rather than
 * before them. Measured with `next` sitting where the contract puts it: a step
 * that wrote its objective before its kind had already skipped a required field,
 * which left `fail` as the only kind the grammar would still take, and every
 * step in every draft came out `fail`.
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

/** What a step decides first, and what it can only decide once the rest is settled. */
const FIRST = ['kind', 'id', 'objective']
const LAST = ['next', 'markerLabel', 'hint', 'requires', 'effects', 'optional', 'hidden']

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

/** Makes a step in the middle of the flow say where the flow goes next. */
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
