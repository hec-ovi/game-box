import { charterContract, premiseContract, SHIPPED_CHARTERS, type Premise } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { Scribe, type ScribeProblem } from '../src/index.ts'
import { fakeModel } from './fake-model.ts'
import { JAIL } from './places.ts'
import { stopped, wrote } from './wrote.ts'

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

/** The same history, built out of a kind of place no preset is. */
const WITH_JAIL: Premise = {
  ...WRITTEN,
  build: { moreOf: ['warehouse', 'jail'], fewerOf: ['office'], mustHave: ['station', 'jail'] },
}

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

    expect(await wrote(scribe.writePremise({ theme: THEME, seed: SEED }))).toEqual(WRITTEN)
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

    // and the call knows the theme, the town it is telling apart from the others, every
    // kind of place a town already has, and that it may name one they are not
    expect(sent[0]!.user).toContain(THEME)
    expect(sent[0]!.user).toContain(SEED)
    for (const charter of SHIPPED_CHARTERS) expect(sent[0]!.user).toContain(charter.word)
    expect(sent[0]!.user).toContain('one plain lowercase word')
    // a history built from the presets alone asks for nothing more
    expect(sent).toHaveLength(1)
  })

  it('asks for the charter behind a kind no preset is, against the world\'s own charter contract, and hands it back on the history', async () => {
    const { sent, scribe } = scribeWith([WITH_JAIL, JAIL])

    expect(await wrote(scribe.writePremise({ theme: THEME, seed: SEED }))).toEqual({ ...WITH_JAIL, charters: [JAIL] })

    // one call per invented word, none for a preset, the word pinned in the schema
    expect(sent.map((call) => call.toolName)).toEqual(['write_premise', 'write_charter'])
    const base = charterContract.jsonSchema() as { properties: Record<string, unknown> }
    expect(sent[1]!.parameters).toEqual({ ...base, properties: { ...base.properties, word: { type: 'string', const: 'jail' } } })
    // and the call is shown the history it is filling in, the word, and the kinds it is not
    const asked = sent[1]!.user
    expect(asked).toContain('Lives on: Container freight off the elevated line, run by the Vance yards.')
    expect(asked).toContain('`word` is jail')
    for (const charter of SHIPPED_CHARTERS) expect(asked).toContain(charter.word)
    expect(scribe.problems()).toEqual([])
  })

  it('shows the charter call the owner\'s own brief, because the charter is where the locks are decided', async () => {
    const brief = 'A disco with a cellar nobody but the doorman gets into.'
    const asked = scribeWith([WITH_JAIL, JAIL])
    const blank = scribeWith([WITH_JAIL, JAIL])

    await wrote(asked.scribe.writePremise({ theme: THEME, seed: SEED, brief }))
    await wrote(blank.scribe.writePremise({ theme: THEME, seed: SEED }))

    expect(asked.sent[1]!.user).toContain(`> ${brief}`)
    // a brief nobody wrote puts nothing in the call, not a line saying it is blank
    expect(blank.sent[1]!.user).not.toContain("in the owner's own words")
  })

  it('sends a charter back with the reason when its blade spells nothing or a template puts one sign over every door', async () => {
    const { sent, scribe } = scribeWith([WITH_JAIL, { ...JAIL, blade: '  ', names: ['County Jail', '{family} Jail'] }, JAIL], 2)

    expect(await wrote(scribe.writePremise({ theme: THEME, seed: SEED }))).toEqual({ ...WITH_JAIL, charters: [JAIL] })
    expect(sent).toHaveLength(3)
    expect(scribe.problems().flatMap(refused)).toEqual(['blade', 'names.0'])
    expect(sent[2]!.user).toContain('names.0: County Jail has no slot')
  })

  it('reads a preset written in the plural as the preset, and asks for no charter for it', async () => {
    const plural: Premise = { ...WRITTEN, build: { moreOf: ['warehouses', 'bars'], fewerOf: ['offices', 'cafes'], mustHave: ['station', 'bar'] } }
    const { sent, scribe } = scribeWith([plural])

    expect(await wrote(scribe.writePremise({ theme: THEME, seed: SEED }))).toEqual({
      ...WRITTEN,
      build: { moreOf: ['warehouse', 'bar'], fewerOf: ['office', 'cafe'], mustHave: ['station', 'bar'] },
    })
    expect(sent).toHaveLength(1)
  })

  it('takes a kind the model will not write out of the build rather than handing it on', async () => {
    const { sent, scribe } = scribeWith([WITH_JAIL, 'no-call'], 1)

    expect(await wrote(scribe.writePremise({ theme: THEME, seed: SEED }))).toEqual({
      ...WITH_JAIL,
      build: { moreOf: ['warehouse'], fewerOf: ['office'], mustHave: ['station'] },
    })
    expect(sent).toHaveLength(2)
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['no-tool-call'])
  })

  it('stops the build on a history the contract refuses, rather than composing one', async () => {
    // half a premise: the sides and the buildings the town would have been built from are missing
    const { scribe } = scribeWith([{ livesOn: 'Freight.', happened: 'The line shut.', stake: 'The contract.' }], 1)

    const failure = await stopped(scribe.writePremise({ theme: THEME, seed: SEED }))

    expect(failure).toMatchObject({ stage: 'history', at: 'premise', code: 'invalid-arguments' })
    expect(failure.message).toContain('the history could not be written')
    expect(scribe.problems().map((problem) => problem.error.code)).toEqual(['invalid-arguments'])
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

    expect(await wrote(scribe.writePremise({ theme: THEME, seed: SEED }))).toEqual(WRITTEN)
    expect(sent).toHaveLength(3)
    expect(scribe.problems().flatMap(refused)).toEqual(['common', 'sides.1.name', 'build', 'build.fewerOf'])
    expect(sent[1]!.user).toContain('rejected')
    expect(sent[2]!.user).toContain('build.fewerOf')
  })

  it('hands the owner\'s brief to the history verbatim, with the tone, the main errand and the look', async () => {
    const brief = 'A port where the freight line shut and everybody pretends it is coming back. Keep it damp.'
    const { sent, scribe } = scribeWith([WRITTEN])

    await wrote(scribe.writePremise({
      theme: THEME,
      seed: SEED,
      brief,
      asks: { tone: 'dry, unsentimental', mainQuest: 'the missing manifest', style: { neon: 'lit', wear: 'run-down' } },
    }))

    const asked = sent[0]!.user
    expect(asked).toContain(`> ${brief}`)
    expect(asked).toContain('The tone the owner asked for: dry, unsentimental')
    expect(asked).toContain('the main errand to be about: the missing manifest')
    expect(asked).toContain('neon lit, wear run-down')
    expect(asked).not.toContain('density')
    expect(asked).not.toContain('The owner left all of this to you')
  })

  it('asks for a good town when the owner left every field blank, and says nothing about the blanks', async () => {
    const { sent, scribe } = scribeWith([WRITTEN])

    await wrote(scribe.writePremise({ theme: THEME, seed: SEED, brief: '  ', asks: { tone: '', style: {} } }))

    const asked = sent[0]!.user
    expect(asked).toContain('The owner left all of this to you')
    expect(asked).not.toContain('undefined')
    expect(asked).not.toContain('asked for:')
    expect(asked).not.toContain('>  ')
  })

  it('asks the same question for the same theme and seed, and a different one for another seed', async () => {
    const run = async (seed: string) => {
      const { sent, scribe } = scribeWith([WRITTEN])
      await wrote(scribe.writePremise({ theme: THEME, seed }))
      return sent[0]!.user
    }

    expect(await run(SEED)).toBe(await run(SEED))
    expect(await run('elsewhere')).not.toBe(await run(SEED))
  })

  it('names the city out of the history, and says so when there is none', async () => {
    const { sent, scribe } = scribeWith([{ name: 'Vance Reach' }])

    expect(await wrote(scribe.nameCity({ theme: THEME, seed: SEED, premise: WRITTEN }))).toBe('Vance Reach')
    expect(sent[0]!.user).toContain('Lives on: Container freight off the elevated line, run by the Vance yards.')
    expect(sent[0]!.user).toContain('the Dockhands Local want the yards broken up')

    const without = scribeWith([{ name: 'Vance Reach' }])
    await wrote(without.scribe.nameCity({ theme: THEME, seed: SEED }))
    expect(without.sent[0]!.user).toContain('Nothing has been written about the city itself yet.')
  })
})
