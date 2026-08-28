import { eachChild, type JsonSchema } from './compact.ts'

/**
 * Narrows the quest sheet schema to what a model can get right, because the
 * schema is what it decodes against and a rule that lives only in the prompt is
 * a rule it can walk past. Everything the narrowed schema still allows, the
 * full sheet contract accepts.
 *
 * - **Nothing a `WorldSummary` cannot name.** The summary lists plots, people
 *   and things and has no interior or anchor ids in it, so a `stash` beat or a
 *   walk into an interior is a beat the model can write and nobody can check.
 * - **No `difficulty`.** Measured on ten live drafts: five paid outside the
 *   band of the tier they named. The pay is what is asked for, and `@gb/quest`
 *   reads the tier off what the reward hands over.
 * - **No `requires`.** The one gate a job needs is the money for what it buys,
 *   and the prices are the city's; `quests.ts` fills it in from the counters
 *   rather than asking the model to add up a bill.
 * - **The pay is written, and it is never nothing.** Measured on ten live
 *   drafts: two rewarded 0 credits while handing over an item or a door, which
 *   puts the reward in a tier whose floor it cannot reach. `money` is required
 *   and starts at 1.
 * - **An errand's length is what a writer should tell, not what the box can
 *   hold.** The contract takes a long run because `keys.ts` adds the
 *   conversations a lock implies before it compiles; the model is asked for
 *   `MOST_BEATS` and a short road, which is the shape of an errand.
 * - **The line says what the beat points at.** The rule `wording.ts` holds a
 *   draft to goes on the field it is written in, because a rule that lives only
 *   in the prompt is a rule the decoder never reads. It costs one string: the
 *   objective is the same subschema in every beat, so it is hoisted once.
 */
export function narrowToSummary(schema: JsonSchema): JsonSchema {
  const root = structuredClone(schema)
  const properties = root['properties'] as Record<string, JsonSchema> | undefined
  if (!properties) return root

  beatArrays(root).forEach((array, index) => {
    array['maxItems'] = index === 0 ? MOST_BEATS : MOST_ON_A_ROAD
    const items = array['items'] as JsonSchema | undefined
    const variants = items?.['oneOf']
    if (!items || !Array.isArray(variants)) return
    items['oneOf'] = variants
      .filter((variant) => kindOf(variant as JsonSchema) !== 'stash')
      .map((variant) => sayWhere(plotsOnly(variant as JsonSchema)))
  })
  delete properties['difficulty']
  delete properties['requires']
  mustPay(properties['reward'])
  return root
}

/** How many beats an errand is told in, and how many a road out of a fork runs. */
const MOST_BEATS = 14
const MOST_ON_A_ROAD = 4

/**
 * Every `beats` array in the schema: the sheet's own, and the one inside a
 * fork's roads. Both are narrowed and both are pinned, so a road cannot write
 * what the main line may not.
 */
export function beatArrays(root: JsonSchema): JsonSchema[] {
  const found: JsonSchema[] = []
  const walk = (node: JsonSchema): void => {
    const beats = (node['properties'] as Record<string, JsonSchema> | undefined)?.['beats']
    if (beats && Array.isArray((beats['items'] as JsonSchema | undefined)?.['oneOf'])) found.push(beats)
    eachChild(node, (child) => walk(child))
  }
  walk(root)
  return found
}

/** The beat variants each of those arrays accepts. */
export function beatLists(root: JsonSchema): JsonSchema[] {
  return beatArrays(root).map((array) => array['items'] as JsonSchema)
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

/** What the line a beat carries has to be about, said where the line is written. */
const OBJECTIVE =
  'The line the player reads while this is the beat to do. Call every person and place in it by the name the city listing gives it, never one of your own. Name only the place this beat happens in and the people standing there. A beat that walks the player somewhere says which building.'

/** Puts that rule on the beat's own `objective`. */
function sayWhere(variant: JsonSchema): JsonSchema {
  const objective = (variant['properties'] as Record<string, JsonSchema> | undefined)?.['objective']
  if (objective) objective['description'] = OBJECTIVE
  return variant
}

export function kindOf(variant: JsonSchema): string | undefined {
  const properties = variant['properties'] as Record<string, JsonSchema> | undefined
  const kind = properties?.['kind']?.['const']
  return typeof kind === 'string' ? kind : undefined
}

/** Leaves `where` with its plot branch only. */
function plotsOnly(variant: JsonSchema): JsonSchema {
  const properties = variant['properties'] as Record<string, JsonSchema> | undefined
  const where = properties?.['where']
  const branches = where?.['anyOf']
  if (!where || !Array.isArray(branches)) return variant

  const plot = branches.find((branch) => 'plotId' in (((branch as JsonSchema)['properties'] as object) ?? {}))
  if (plot) properties!['where'] = plot as JsonSchema
  return variant
}
