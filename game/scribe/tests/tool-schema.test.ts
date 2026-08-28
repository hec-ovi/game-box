import { questSheetContract } from '@gb/quest'
import { describe, expect, it } from 'vitest'
import { compactSchema, expandSchema, type JsonSchema } from '../src/schema/compact.ts'
import { pinToCorner, type CornerIds } from '../src/schema/corner.ts'
import { beatArrays, beatLists, narrowToSummary } from '../src/schema/narrow.ts'
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

const full = () => questSheetContract.jsonSchema() as JsonSchema
/** The beats the main line may write. A fork's roads carry their own list, narrowed and pinned with this one. */
const beatVariants = (schema: JsonSchema) => beatLists(schema)[0]!['oneOf'] as JsonSchema[]
const kinds = (schema: JsonSchema) => beatVariants(schema).map((variant) => (variant['properties'] as Record<string, JsonSchema>)['kind']!['const'])
const beat = (schema: JsonSchema, kind: string) =>
  beatVariants(schema).find((variant) => (variant['properties'] as Record<string, JsonSchema>)['kind']!['const'] === kind)!

describe('the schema the model is handed', () => {
  it('says exactly what the contract says, written without the repeats', () => {
    const narrowed = narrowToSummary(full())
    expect(expandSchema(compactSchema(narrowed))).toEqual(narrowed)
  })

  it('is a fraction of the contract it came from', () => {
    const before = JSON.stringify(full()).length
    const after = JSON.stringify(questToolSchema(CORNER)).length
    expect(after).toBeLessThan(before / 1.5)
  })

  it('asks for an errand, not for as long a run as the box can hold', () => {
    // the contract takes a long run because `keys.ts` puts the conversations a
    // lock implies into it before it is compiled; what the model is asked for
    // is the shape of an errand
    const [main, road] = beatArrays(narrowToSummary(full()))
    expect(main!['maxItems']).toBe(14)
    expect(road!['maxItems']).toBe(4)
    expect((full()['properties'] as Record<string, JsonSchema>)['beats']!['maxItems']).toBeGreaterThan(14)
  })

  it('drops only the beats a summary cannot name: stash, and going into an interior', () => {
    const narrowed = narrowToSummary(full())
    expect(kinds(full())).toContain('stash')
    expect(kinds(narrowed)).toEqual(kinds(full()).filter((kind) => kind !== 'stash'))

    const where = (beat(narrowed, 'goto')['properties'] as Record<string, JsonSchema>)['where']!
    expect(where['anyOf']).toBeUndefined()
    expect(JSON.stringify(where)).toContain('plotId')
    const handed = JSON.stringify(questToolSchema(CORNER))
    expect(handed).not.toContain('anchorId')
    expect(handed).not.toContain('"stash"')
    // a beat never goes indoors, but a reward may open a place's street door or hand over its deed
    expect(JSON.stringify(beatVariants(questToolSchema(CORNER)))).not.toContain('interiorId')
    expect(handed).toContain('"deed"')
  })

  it('asks for the pay alone and for no gate of its own', () => {
    const narrowed = narrowToSummary(full())
    const properties = Object.keys(narrowed['properties'] as object)
    // the tier is read off what the reward hands over, and the bill for a buy is the city's to add up
    expect(properties).not.toContain('difficulty')
    expect(properties).not.toContain('requires')
    // and the pay is written, never nothing: a reward of 0 sits under the floor of any tier that carries a thing
    const reward = (narrowed['properties'] as Record<string, JsonSchema>)['reward']!
    expect(reward['required']).toEqual(['money'])
    expect((reward['properties'] as Record<string, JsonSchema>)['money']).toMatchObject({ minimum: 1 })
  })

  it('puts what a beat is before what it says, so the sentence follows the mechanic', () => {
    // measured with the fields the other way round: a beat that wrote its line
    // first had already skipped a required field by the time it named its kind
    for (const variant of beatVariants(full())) {
      const properties = variant['properties'] as Record<string, JsonSchema>
      const order = Object.keys(properties)
      expect(order[0]).toBe('kind')
      // the line is written once the beat knows who and what it is about; a fork's roads come after it
      expect(order.at(-1)).toBe(properties['kind']!['const'] === 'choice' ? 'options' : 'objective')
    }
  })

  it('pins every id to the corner, so an id the city has not got cannot be written', () => {
    const pinned = pinToCorner(narrowToSummary(full()), CORNER)
    const text = JSON.stringify(pinned)
    expect(text).not.toMatch(/\^npc_|\^item_|\^plot_|\^door_|\^interior_/)
    const enumOf = (variant: JsonSchema, field: string) => (variant['properties'] as Record<string, JsonSchema>)[field]!['enum']
    expect(enumOf(beat(pinned, 'talk'), 'npcId')).toEqual(['npc_0001', 'npc_0002'])
    expect(enumOf(beat(pinned, 'unlock'), 'doorId')).toEqual(['door_0003'])
    expect(enumOf(beat(pinned, 'hack'), 'machineId')).toEqual(['machine_0002'])
    expect(enumOf(beat(pinned, 'beat-game'), 'machineId')).toEqual(['machine_0001'])
    expect(enumOf(beat(pinned, 'buy'), 'itemId')).toEqual(['item_0002'])
    expect(enumOf(beat(pinned, 'collect'), 'itemId')).toEqual(['item_0001', 'item_0002'])
    expect(text).toContain('"enum":["bramble-80"]')
    const reward = (pinned['properties'] as Record<string, JsonSchema>)['reward']!['properties'] as Record<string, JsonSchema>
    expect(reward['deed']!['enum']).toEqual(['interior_0001'])
    expect(reward['car']).toBeDefined()
    // and the whole thing still says what the contract says, written without repeats
    expect(expandSchema(compactSchema(pinned))).toEqual(pinned)
  })

  it('holds a fork\'s roads to the same beats as the main line', () => {
    const pinned = pinToCorner(narrowToSummary(full()), PLAIN)
    const [main, road] = beatLists(pinned)
    expect(road).toBeDefined()
    // a road runs its own beats and every one of them but the fork itself
    const inRoad = (road!['oneOf'] as JsonSchema[]).map((variant) => (variant['properties'] as Record<string, JsonSchema>)['kind']!['const'])
    expect(inRoad).toEqual(
      (main!['oneOf'] as JsonSchema[])
        .map((variant) => (variant['properties'] as Record<string, JsonSchema>)['kind']!['const'])
        .filter((kind) => kind !== 'choice'),
    )
  })

  it('never leaves an id open, whatever the corner is short of', () => {
    // measured against the local model: a call whose ids were plain strings came
    // back naming a person the city did not have. An id the grammar cannot write
    // is a mistake the model cannot make, so a list the corner cannot fill takes
    // the beat with it rather than leaving the field open. Every corner has
    // somebody to ask, something to fetch and somewhere to go (`Neighbourhood`
    // guarantees it); everything else it may be short of
    const lists = ['plots', 'interiors', 'doors', 'screens', 'games', 'counters', 'codes', 'homes'] as const
    const patterns = /\^npc_|\^item_|\^plot_|\^door_|\^interior_/
    for (const list of lists) {
      const text = JSON.stringify(pinToCorner(narrowToSummary(full()), { ...CORNER, [list]: [] }))
      expect(text, `a corner with no ${list} leaves an id open`).not.toMatch(patterns)
    }
    const bare = { ...CORNER, ...(Object.fromEntries(lists.map((list) => [list, []])) as unknown as CornerIds), bench: false }
    expect(JSON.stringify(pinToCorner(narrowToSummary(full()), bare))).not.toMatch(patterns)
  })

  it('offers no beat the corner cannot serve', () => {
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
