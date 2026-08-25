import { describe, expect as vitestExpect, it } from 'vitest'
import { z } from 'zod'
import { contract, err, expect, IdMinter, ok, Rng } from '../src/index.ts'

describe('Rng', () => {
  it('is reproducible from a seed and independent per fork', () => {
    const draw = (rng: Rng) => [rng.float(), rng.int(0, 100), rng.pick(['a', 'b', 'c'])]
    vitestExpect(draw(new Rng('town-1'))).toEqual(draw(new Rng('town-1')))
    vitestExpect(draw(new Rng('town-1'))).not.toEqual(draw(new Rng('town-2')))

    // a fork's stream depends on its label only, so adding plot_02 later cannot
    // change what plot_01 already drew
    const parent = new Rng('city')
    const first = parent.fork('plot_01').float()
    parent.fork('plot_99').float()
    vitestExpect(new Rng('city').fork('plot_01').float()).toBe(first)
  })

  it('stays inside the ranges it promises', () => {
    const rng = new Rng('ranges')
    for (let i = 0; i < 500; i++) {
      const f = rng.float()
      vitestExpect(f).toBeGreaterThanOrEqual(0)
      vitestExpect(f).toBeLessThan(1)
      const n = rng.int(5, 9)
      vitestExpect(n).toBeGreaterThanOrEqual(5)
      vitestExpect(n).toBeLessThan(9)
      vitestExpect(rng.shuffle([1, 2, 3]).toSorted()).toEqual([1, 2, 3])
    }
    vitestExpect(rng.weighted([['only', 1], ['never', 0]])).toBe('only')
  })

  it('states its edges: collapsed ranges, certain chances, empty lists', () => {
    const rng = new Rng('edges')
    vitestExpect(rng.int(4, 4)).toBe(4)
    vitestExpect(rng.int(4, 2)).toBe(4)
    vitestExpect(rng.range(4, 4)).toBe(4)
    vitestExpect(rng.chance(0)).toBe(false)
    vitestExpect(rng.chance(1)).toBe(true)
    vitestExpect(rng.shuffle([])).toEqual([])
    vitestExpect(() => rng.pick([])).toThrow()
    vitestExpect(() => rng.weighted([['a', 0], ['b', -1]])).toThrow()
  })
})

describe('IdMinter', () => {
  it('reads the kind back out of an id', () => {
    vitestExpect(IdMinter.kindOf('npc_0007')).toBe('npc')
    vitestExpect(IdMinter.kindOf('street_lamp_0012')).toBe('street_lamp')
  })

  it('never reuses an id and resumes from a snapshot', () => {
    const first = new IdMinter()
    vitestExpect(first.mint('npc')).toBe('npc_0001')
    vitestExpect(first.mint('npc')).toBe('npc_0002')
    vitestExpect(first.mint('plot')).toBe('plot_0001')

    const resumed = new IdMinter(first.snapshot())
    vitestExpect(resumed.mint('npc')).toBe('npc_0003')
    vitestExpect(IdMinter.kindOf('npc_0003')).toBe('npc')
  })
})

describe('Contract', () => {
  const Person = contract('person', z.object({ name: z.string().min(1), age: z.number().int().min(0) }))

  it('accepts valid data, points at the field that failed, and publishes JSON Schema', () => {
    vitestExpect(Person.parse({ name: 'Mara', age: 34 })).toEqual(ok({ name: 'Mara', age: 34 }))

    const bad = Person.parse({ name: '', age: -1 })
    vitestExpect(bad.ok).toBe(false)
    if (!bad.ok) vitestExpect(bad.error.map((v) => v.path)).toEqual(['name', 'age'])

    const json = Person.jsonSchema()
    vitestExpect(json).toMatchObject({ type: 'object', properties: { name: { type: 'string' } } })
  })
})

describe('Result', () => {
  it('unwraps ok and throws on err with context', () => {
    vitestExpect(expect(ok(7), 'seven')).toBe(7)
    vitestExpect(() => expect(err('nope'), 'context')).toThrow(/context/)
  })
})
