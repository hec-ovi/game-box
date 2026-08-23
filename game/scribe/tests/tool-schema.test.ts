import { questDraftContract } from '@gb/quest'
import { describe, expect, it } from 'vitest'
import { compactSchema, expandSchema, type JsonSchema } from '../src/schema/compact.ts'
import { narrowToSummary } from '../src/schema/narrow.ts'
import { questToolSchema } from '../src/tools.ts'

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
    const after = JSON.stringify(questToolSchema()).length
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
    const handed = JSON.stringify(questToolSchema())
    expect(handed).not.toContain('interiorId')
    expect(handed).not.toContain('anchorId')
    expect(handed).not.toContain('"stash"')
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

  it('leaves every other schema alone', () => {
    const plain = compactSchema({ type: 'object', properties: { a: { type: 'string' } } })
    expect(plain).toEqual({ type: 'object', properties: { a: { type: 'string' } } })
  })
})
