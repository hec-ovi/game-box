import { questDraftContract } from '@gb/quest'
import { describe, expect, it } from 'vitest'
import { compactSchema, expandSchema, type JsonSchema } from '../src/schema/compact.ts'
import { pinToCorner, type CornerIds } from '../src/schema/corner.ts'
import { narrowToSummary } from '../src/schema/narrow.ts'
import { questToolSchema } from '../src/tools.ts'

/** A corner with one of everything a job can be written through. */
const CORNER: CornerIds = {
  npcs: ['npc_0001', 'npc_0002'],
  items: ['item_0001', 'item_0002'],
  plots: ['plot_0001'],
  interiors: ['interior_0001'],
  doors: ['door_0003'],
  screens: ['machine_0002'],
  games: ['machine_0001'],
  counters: ['item_0002'],
  codes: ['bramble-80'],
  homes: ['interior_0001'],
  bench: true,
}

/** A corner with nothing locked, no screen, nothing priced and nothing for sale. */
const PLAIN: CornerIds = { ...CORNER, doors: [], screens: [], games: [], counters: [], codes: [], homes: [], bench: false }

const full = () => questDraftContract.jsonSchema() as JsonSchema
const stepVariants = (schema: JsonSchema) =>
  ((schema['properties'] as Record<string, JsonSchema>)['steps']!['items'] as JsonSchema)['oneOf'] as JsonSchema[]
const kinds = (schema: JsonSchema) =>
  stepVariants(schema).map((variant) => (variant['properties'] as Record<string, JsonSchema>)['kind']!['const'])

describe('the schema the model is handed', () => {
  it('says exactly what the contract says, written without the repeats', () => {
    const narrowed = narrowToSummary(full())
    expect(expandSchema(compactSchema(narrowed))).toEqual(narrowed)
  })

  it('is a fraction of the contract it came from', () => {
    const before = JSON.stringify(full()).length
    const after = JSON.stringify(questToolSchema(CORNER)).length
    expect(before).toBeGreaterThan(40_000)
    expect(after).toBeLessThan(before / 3)
  })

  it('drops only the steps a summary cannot name: stash, and going into an interior', () => {
    const narrowed = narrowToSummary(full())
    expect(kinds(full())).toContain('stash')
    expect(kinds(narrowed)).toEqual(kinds(full()).filter((kind) => kind !== 'stash'))

    const goto = stepVariants(narrowed).find(
      (variant) => (variant['properties'] as Record<string, JsonSchema>)['kind']!['const'] === 'goto',
    )!
    const place = (goto['properties'] as Record<string, JsonSchema>)['place']!
    expect(place['anyOf']).toBeUndefined()
    expect(JSON.stringify(place)).toContain('plotId')
    const handed = JSON.stringify(questToolSchema(CORNER))
    expect(handed).not.toContain('anchorId')
    expect(handed).not.toContain('"stash"')
    // a step never goes indoors, but a reward may open a place's street door or hand over its deed
    expect(JSON.stringify(stepVariants(questToolSchema(CORNER)))).not.toContain('interiorId')
    expect(handed).toContain('"deed"')
  })

  it('makes a step in the middle of the flow say where the flow goes next', () => {
    const narrowed = narrowToSummary(full())
    const requiredOn = (kind: string) =>
      (stepVariants(narrowed).find(
        (variant) => (variant['properties'] as Record<string, JsonSchema>)['kind']!['const'] === kind,
      )!['required'] as string[]) ?? []

    // measured: six drafts out of six left it off, because the contract lets them
    expect(requiredOn('collect')).toContain('next')
    expect(requiredOn('talk')).toContain('next')
    expect(requiredOn('deliver')).toContain('next')
    for (const kind of ['unlock', 'hack', 'beat-game', 'buy']) expect(requiredOn(kind)).toContain('next')
    // choice routes through its own options instead
    expect(requiredOn('choice')).not.toContain('next')
    // and the two that end a quest cannot carry one at all
    for (const kind of ['complete', 'fail']) {
      const variant = stepVariants(narrowed).find(
        (candidate) => (candidate['properties'] as Record<string, JsonSchema>)['kind']!['const'] === kind,
      )!
      expect(Object.keys(variant['properties'] as object)).not.toContain('next')
    }
  })

  it('puts what a step is before what it says, so the sentence follows the mechanic', () => {
    for (const variant of stepVariants(narrowToSummary(full()))) {
      const order = Object.keys(variant['properties'] as object)
      expect(order.slice(0, 3)).toEqual(['kind', 'id', 'objective'])
      const next = order.indexOf('next')
      if (next >= 0) expect(next).toBeGreaterThan(order.indexOf('objective'))
    }
  })

  it('asks for the pay alone and offers no secret and no pay effect: the tier is read off the reward', () => {
    const narrowed = narrowToSummary(full())
    expect(Object.keys(narrowed['properties'] as object)).not.toContain('difficulty')
    for (const variant of stepVariants(narrowed)) {
      const properties = variant['properties'] as Record<string, JsonSchema>
      expect(Object.keys(properties)).not.toContain('hidden')
      const effects = ((properties['effects']!['items'] as JsonSchema)['oneOf'] as JsonSchema[]).map(
        (effect) => (effect['properties'] as Record<string, JsonSchema>)['kind']!['const'],
      )
      expect(effects).not.toContain('reveal')
      expect(effects).not.toContain('pay')
      const kind = properties['kind']!['const']
      // a code given at the door or the screen lands after it was tried
      if (kind === 'unlock' || kind === 'hack') expect(effects).not.toContain('give-password')
      else expect(effects).toContain('give-password')
      // and no step is optional: a side trip the model cannot rejoin is a quest with no path to its ending
      expect(Object.keys(properties)).not.toContain('optional')
    }
    // and the pay is written, never nothing: a reward of 0 sits under the floor of any tier that carries a thing
    const reward = (narrowed['properties'] as Record<string, JsonSchema>)['reward']!
    expect(reward['required']).toEqual(['money'])
    expect((reward['properties'] as Record<string, JsonSchema>)['money']).toMatchObject({ minimum: 1 })
  })

  it('pins every id to the corner, so an id the city has not got cannot be written', () => {
    const pinned = pinToCorner(narrowToSummary(full()), CORNER)
    const text = JSON.stringify(pinned)
    expect(text).not.toMatch(/\^npc_|\^item_|\^plot_|\^door_|\^interior_/)
    const step = (kind: string) =>
      stepVariants(pinned).find((variant) => (variant['properties'] as Record<string, JsonSchema>)['kind']!['const'] === kind)!
    const enumOf = (variant: JsonSchema, field: string) => (variant['properties'] as Record<string, JsonSchema>)[field]!['enum']
    expect(enumOf(step('talk'), 'npcId')).toEqual(['npc_0001', 'npc_0002'])
    expect(enumOf(step('unlock'), 'doorId')).toEqual(['door_0003'])
    expect(enumOf(step('hack'), 'machineId')).toEqual(['machine_0002'])
    expect(enumOf(step('beat-game'), 'machineId')).toEqual(['machine_0001'])
    expect(enumOf(step('buy'), 'itemId')).toEqual(['item_0002'])
    expect(enumOf(step('collect'), 'itemId')).toEqual(['item_0001', 'item_0002'])
    expect(text).toContain('"enum":["bramble-80"]')
    const reward = (pinned['properties'] as Record<string, JsonSchema>)['reward']!['properties'] as Record<string, JsonSchema>
    expect(reward['deed']!['enum']).toEqual(['interior_0001'])
    expect(reward['car']).toBeDefined()
    // and the whole thing still says what the contract says, written without repeats
    expect(expandSchema(compactSchema(pinned))).toEqual(pinned)
  })

  it('offers no step the corner cannot serve', () => {
    const pinned = pinToCorner(narrowToSummary(full()), PLAIN)
    expect(kinds(pinned)).toEqual(kinds(narrowToSummary(full())).filter((kind) => !['unlock', 'hack', 'beat-game', 'buy'].includes(kind as string)))
    const text = JSON.stringify(pinned)
    expect(text).not.toContain('give-password')
    expect(text).not.toContain('"deed"')
    expect(text).not.toContain('"car"')
    expect(text).not.toContain('doorId')
    expect(text).toContain('interiorId')
  })

  it('leaves every other schema alone', () => {
    const plain = compactSchema({ type: 'object', properties: { a: { type: 'string' } } })
    expect(plain).toEqual({ type: 'object', properties: { a: { type: 'string' } } })
  })
})
