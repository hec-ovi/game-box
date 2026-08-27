import { floorFor, moneyMeans } from '../reward-bands.ts'
import { eachChild, type JsonSchema } from './compact.ts'

/** Every id a quest set in one corner of the city may name, by what it is. */
export interface CornerIds {
  readonly npcs: readonly string[]
  readonly items: readonly string[]
  readonly plots: readonly string[]
  /** The places that open, which an access or a deed reward names. */
  readonly interiors: readonly string[]
  readonly doors: readonly string[]
  /** Locked screens, the ones a `hack` opens. */
  readonly screens: readonly string[]
  /** Screens running a game, the ones a `beat-game` is played on. */
  readonly games: readonly string[]
  /** Things with a price over a counter, the ones a `buy` pays for. */
  readonly counters: readonly string[]
  /** Every code a door or a screen in the corner takes. */
  readonly codes: readonly string[]
  /** The places for sale, which a `deed` reward names. */
  readonly homes: readonly string[]
  /** Whether anybody in the corner works at a bench, which is where a `car` reward comes from. */
  readonly bench: boolean
}

/** The fields of a corner that are lists of ids. */
type IdList = { [K in keyof CornerIds]: CornerIds[K] extends readonly string[] ? K : never }[keyof CornerIds]

/** What each step kind needs the corner to hold before it may be offered at all. */
const NEEDS: Readonly<Record<string, readonly IdList[]>> = {
  talk: ['npcs'],
  goto: ['plots'],
  collect: ['items'],
  deliver: ['items', 'npcs'],
  escort: ['npcs', 'plots'],
  unlock: ['doors'],
  hack: ['screens'],
  'beat-game': ['games'],
  buy: ['counters'],
}

/** The id patterns the contract writes, and the list of the corner each one becomes. */
const ID_LISTS: readonly (readonly [RegExp, IdList])[] = [
  [/^\^npc_/, 'npcs'],
  [/^\^item_/, 'items'],
  [/^\^plot_/, 'plots'],
  [/^\^interior_/, 'interiors'],
  [/^\^door_/, 'doors'],
]

/**
 * Pins the quest schema to one corner of the city, so the only ids the model
 * can decode are the ones it was shown.
 *
 * Measured on ten live drafts: one named a door the city did not have, and
 * the retry on a new seed rewrote the whole quest rather than the one id. An
 * id the grammar cannot produce is a mistake the model cannot make, which is
 * how the place tool already holds its post ids. So every id pattern becomes
 * the corner's own list, a `hack` may only name a locked screen, a `beat-game`
 * a screen running a game, a `buy` a thing with a price, a `give-password` a
 * code the corner has, a `deed` a place for sale and a `car` a corner with a
 * bench in it, and a step kind the corner cannot serve is not offered at all.
 * Everything this still allows, the full draft contract accepts.
 *
 * Measured on the tool as it goes out: 115 id fields on a corner with one of
 * everything, and every one of them an enum.
 */
export function pinToCorner(schema: JsonSchema, ids: CornerIds): JsonSchema {
  const root = structuredClone(schema)
  const properties = root['properties'] as Record<string, JsonSchema>
  const steps = (properties['steps']!['items'] as JsonSchema)['oneOf'] as JsonSchema[]

  properties['steps']!['items'] = {
    ...(properties['steps']!['items'] as JsonSchema),
    oneOf: steps.filter((step) => serves(step, ids)).map((step) => pinStep(step, ids)),
  }
  pinReward(properties['reward']!, ids)
  pinPatterns(root, ids)
  return root
}

function kindOf(variant: JsonSchema): string {
  const kind = ((variant['properties'] as Record<string, JsonSchema> | undefined)?.['kind'] as JsonSchema | undefined)?.['const']
  return typeof kind === 'string' ? kind : ''
}

/**
 * Whether the corner holds what this step kind needs. A kind whose target list
 * is empty is not offered at all, because the alternative is an id field the
 * grammar leaves open, and an open id field is one the model fills in itself.
 */
function serves(step: JsonSchema, ids: CornerIds): boolean {
  return (NEEDS[kindOf(step)] ?? []).every((list) => ids[list].length > 0)
}

function pinStep(step: JsonSchema, ids: CornerIds): JsonSchema {
  const properties = step['properties'] as Record<string, JsonSchema>
  const kind = kindOf(step)
  if (kind === 'hack') properties['machineId'] = oneOf(ids.screens)
  if (kind === 'beat-game') properties['machineId'] = oneOf(ids.games)
  if (kind === 'buy') {
    properties['itemId'] = oneOf(ids.counters)
    if (properties['alternates']) properties['alternates'] = { ...properties['alternates'], items: oneOf(ids.counters) }
  }
  const effects = properties['effects']?.['items'] as JsonSchema | undefined
  const variants = effects?.['oneOf']
  if (effects && Array.isArray(variants)) {
    effects['oneOf'] = variants.flatMap((effect) => {
      if (kindOf(effect as JsonSchema) !== 'give-password') return [effect]
      if (ids.codes.length === 0) return []
      const own = structuredClone(effect as JsonSchema)
      ;(own['properties'] as Record<string, JsonSchema>)['password'] = oneOf(ids.codes)
      return [own]
    })
  }
  return step
}

/**
 * An access names a door of the corner or the street door of a place that
 * opens, a deed a place for sale, a car a bench somebody works at. None of the
 * three is offered where the corner has none.
 *
 * The pay band goes on the fields that decide it: what the tiers are on
 * `money`, and what handing over a car or a home commits the pay to on those
 * two, since that is where the decision is made and the prompt's table is a
 * page away by then.
 */
function pinReward(reward: JsonSchema, ids: CornerIds): void {
  const properties = reward['properties'] as Record<string, JsonSchema>
  const money = properties['money']
  if (money) money['description'] = moneyMeans()
  if (ids.homes.length) properties['deed'] = { ...oneOf(ids.homes), description: `The place whose deed this job hands over.${floorFor('deed')}` }
  else delete properties['deed']
  if (ids.bench && properties['car']) properties['car'] = { ...properties['car'], description: `${String(properties['car']['description'] ?? 'The car this job hands over.')}${floorFor('car')}` }
  if (!ids.bench) delete properties['car']

  const access = properties['access']
  const branches = (access?.['items'] as JsonSchema | undefined)?.['anyOf']
  if (!access || !Array.isArray(branches)) return
  const kept = branches.filter((branch) => {
    const named = Object.keys(((branch as JsonSchema)['properties'] as object) ?? {})[0]
    return named === 'doorId' ? ids.doors.length > 0 : ids.interiors.length > 0
  })
  if (kept.length) access['items'] = { ...(access['items'] as JsonSchema), anyOf: kept }
  else delete properties['access']
}

/** Every id pattern left becomes the corner's own list, where the corner has one. */
function pinPatterns(node: JsonSchema, ids: CornerIds): void {
  eachChild(node, (child, replace) => {
    const pattern = child['pattern']
    const list = typeof pattern === 'string' ? ID_LISTS.find(([match]) => match.test(pattern)) : undefined
    if (list && ids[list[1]].length) replace(oneOf(ids[list[1]]))
    else pinPatterns(child, ids)
  })
}

function oneOf(values: readonly string[]): JsonSchema {
  return { type: 'string', enum: [...values] }
}
