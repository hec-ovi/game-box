import type { JsonSchema } from './compact.ts'

/** The step kinds the flow check refuses to let dangle: every one of them has to lead somewhere. */
const MUST_LEAD_ON = new Set(['talk', 'goto', 'collect', 'buy', 'deliver', 'escort', 'unlock', 'hack', 'beat-game', 'join', 'any-of'])

/** The step kinds that end a quest: the flow check refuses a `next` on either of them. */
const ENDS_IT = new Set(['complete', 'fail'])

/** What a step decides first, and what it can only fill in once the rest is settled. */
const FIRST = ['kind', 'id', 'objective']
const LAST = ['next', 'markerLabel', 'hint', 'requires', 'effects']

/** The effects a small model gets wrong more often than right: a `reveal` on a step that is not hidden, a `pay` that breaks the band the reward already fills. */
const CUT_EFFECTS = new Set(['reveal', 'pay'])

/** The step kinds that open something: a code given on one of these lands after the door or the screen was tried. */
const OPENS = new Set(['unlock', 'hack'])

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
 * - **No secrets, no `pay`, no `difficulty`.** Measured on ten live drafts:
 *   three revealed a step that was not hidden, and five paid outside the band
 *   of the tier they named. So `hidden` and `reveal` are cut, `pay` is cut
 *   (the reward is the pay), and `difficulty` is cut and read off what the
 *   reward hands over instead (`tier.ts`).
 * - **The pay is written, and it is never nothing.** Measured on ten live
 *   drafts: two rewarded 0 credits while handing over an item or a door, which
 *   puts the reward in a tier whose floor it cannot reach, and both were sent
 *   back. `money` is required and starts at 1, so a quest that pays nothing is
 *   a quest the grammar will not write.
 * - **No step is optional, and a code is never given at the door.** Measured
 *   on two live 3x3 towns: five of eighteen drafts hung the only path to
 *   `complete` off a step they had marked optional, and none wrote a side
 *   trip that rejoined; two earlier drafts marked the `complete` step itself
 *   optional, which is a quest with no ending. So `optional` is not offered
 *   at all. One draft put the `give-password` on the `hack` step itself,
 *   where it lands after the screen was tried, so it is gone from the two
 *   opening kinds.
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
    .map((variant) => inWritingOrder(mustLead(plotsOnly(noSideTrips(noSecrets(variant as JsonSchema))))))
  delete (root['properties'] as Record<string, JsonSchema>)['difficulty']
  mustPay((root['properties'] as Record<string, JsonSchema>)['reward'])
  return root
}

/** Makes the reward say what the job pays, and refuses nothing as an answer. */
function mustPay(reward: JsonSchema | undefined): void {
  const money = (reward?.['properties'] as Record<string, JsonSchema> | undefined)?.['money']
  if (!money) return
  money['minimum'] = 1
  delete money['default']
  const required: string[] = Array.isArray(reward!['required']) ? reward!['required'] : []
  if (!required.includes('money')) reward!['required'] = [...required, 'money']
}

/** Takes `hidden` off the step and the `reveal` and `pay` effects out of its list, and the `give-password` off a step that opens something. */
function noSecrets(variant: JsonSchema): JsonSchema {
  const properties = variant['properties'] as Record<string, JsonSchema> | undefined
  if (!properties) return variant
  delete properties['hidden']
  const cut = new Set(OPENS.has(kindOf(variant) ?? '') ? [...CUT_EFFECTS, 'give-password'] : CUT_EFFECTS)
  const effects = (properties['effects']?.['items'] as JsonSchema | undefined)?.['oneOf']
  if (Array.isArray(effects)) {
    properties['effects']!['items'] = {
      ...(properties['effects']!['items'] as JsonSchema),
      oneOf: effects.filter((effect) => !cut.has(kindOf(effect as JsonSchema) ?? '')),
    }
  }
  return variant
}

/** Takes the side trip off a step: a branch that rejoins the main line is one a model writes as a dead end. */
function noSideTrips(variant: JsonSchema): JsonSchema {
  const properties = variant['properties'] as Record<string, JsonSchema> | undefined
  if (properties) delete properties['optional']
  return variant
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
