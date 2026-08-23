import { OfflineNarrator } from '@gb/forge'
import { BUILDING_KINDS, premiseContract, type Premise } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Scribe, type ScribeProblem } from '../src/index.ts'
import { fakeModel } from './fake-model.ts'

const THEME = 'neon city, the freight lines shut last winter'
const SEED = 'harbour'

/** A history a town can actually be built out of, which is what the tool asks for. */
const WRITTEN: Premise = {
  livesOn: 'Container freight off the elevated line, run by the Vance yards.',
  happened: 'The line shut last winter and the yards have been idle since.',
  stake: 'Who gets the freight contract when the line reopens in the spring.',
  sides: [
    { name: 'the Vance yards', wants: 'the contract back on the old terms' },
    { name: 'the Dockhands Local', wants: 'the yards broken up and the work shared out' },
  ],
  common: ['Nothing has moved through the yards since November.', 'The Local meets over the Halfmast bar.'],
  build: { moreOf: ['warehouse', 'bar'], fewerOf: ['office', 'cafe'], mustHave: ['station'] },
}

/** What the town falls back to when the model writes nothing usable. */
const composed = (): Promise<Premise> => new OfflineNarrator(SEED).writePremise({ theme: THEME, seed: SEED })

const scribeWith = (answers: unknown[], attempts?: number) => {
  const { sent, sidecar } = fakeModel(answers)
  return { sent, scribe: new Scribe({ sidecar, seed: SEED, ...(attempts ? { attempts } : {}) }) }
}

/** The fields one rejected answer was told to fix. */
const refused = (problem: ScribeProblem): readonly string[] =>
  problem.error.code === 'invalid-arguments' ? problem.error.violations.map((one) => one.path) : []

describe('the city history', () => {
  it('is one forced call whose parameters are the premise contract, the buildings written last', async () => {
    const { sent, scribe } = scribeWith([WRITTEN])

    expect(await scribe.writePremise({ theme: THEME, seed: SEED })).toEqual(WRITTEN)
    expect(sent[0]!.toolName).toBe('write_premise')
    // the shape is the forge's own, never a copy of it: a copy is a shape that can drift
    expect(sent[0]!.parameters).toEqual(premiseContract.jsonSchema())

    // a constrained model writes the properties in the order the schema lists them, so the
    // history is written before the buildings that have to follow from it
    const properties = (sent[0]!.parameters as { properties: Record<string, unknown> }).properties
    expect(Object.keys(properties)).toEqual(['livesOn', 'happened', 'stake', 'sides', 'common', 'build'])
    expect(Object.keys((properties['build'] as { properties: object }).properties)).toEqual([
      'moreOf',
      'fewerOf',
      'mustHave',
    ])

    // and the call knows the theme, the town it is telling apart from the others, and every
    // kind of building it may ask the town for
    expect(sent[0]!.user).toContain(THEME)
    expect(sent[0]!.user).toContain(SEED)
    for (const kind of BUILDING_KINDS) expect(sent[0]!.user).toContain(kind)
  })

  it('drops a history the contract refuses and gives the town the one the seed composes', async () => {
    // half a premise: the sides and the buildings the town would have been built from are missing
    const { scribe } = scribeWith([{ livesOn: 'Freight.', happened: 'The line shut.', stake: 'The contract.' }], 1)

    expect(await scribe.writePremise({ theme: THEME, seed: SEED })).toEqual(await composed())
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['invalid-arguments'])
  })

  it('gives the town a history when the model is down', async () => {
    const { scribe } = scribeWith(['no-call'], 1)

    expect(await scribe.writePremise({ theme: THEME, seed: SEED })).toEqual(await composed())
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['no-tool-call'])
  })

  it('sends a history that would build no town back with the reason, and takes the corrected one', async () => {
    // both of these pass the contract and neither of them builds anything: one town has
    // nothing everybody knows, one argument with itself and no buildings named at all,
    // and the other wants more and fewer of the same thing
    const noTown: Premise = {
      ...WRITTEN,
      sides: [WRITTEN.sides[0]!, { name: 'The Vance Yards', wants: 'the same thing' }],
      common: [],
      build: { moreOf: [], fewerOf: [], mustHave: [] },
    }
    const bothWays: Premise = { ...WRITTEN, build: { moreOf: ['bar'], fewerOf: ['bar'], mustHave: [] } }
    const { sent, scribe } = scribeWith([noTown, bothWays, WRITTEN], 3)

    expect(await scribe.writePremise({ theme: THEME, seed: SEED })).toEqual(WRITTEN)
    expect(sent).toHaveLength(3)
    expect(scribe.problems().flatMap(refused)).toEqual(['common', 'sides.1.name', 'build', 'build.fewerOf'])
    expect(sent[1]!.user).toContain('rejected')
    expect(sent[2]!.user).toContain('build.fewerOf')
  })

  it('asks the same question for the same theme and seed, and a different one for another seed', async () => {
    const run = async (seed: string) => {
      const { sent, scribe } = scribeWith([WRITTEN])
      await scribe.writePremise({ theme: THEME, seed })
      return sent[0]!.user
    }

    expect(await run(SEED)).toBe(await run(SEED))
    expect(await run('elsewhere')).not.toBe(await run(SEED))
  })

  it('names the city out of the history, and says so when there is none', async () => {
    const { sent, scribe } = scribeWith([{ name: 'Vance Reach' }])

    expect(await scribe.nameCity({ theme: THEME, seed: SEED, premise: WRITTEN })).toBe('Vance Reach')
    expect(sent[0]!.user).toContain('Lives on: Container freight off the elevated line, run by the Vance yards.')
    expect(sent[0]!.user).toContain('the Dockhands Local want the yards broken up')

    const without = scribeWith([{ name: 'Vance Reach' }])
    await without.scribe.nameCity({ theme: THEME, seed: SEED })
    expect(without.sent[0]!.user).toContain('Nothing has been written about the city itself yet.')
  })
})
