import { describe, expect, it } from 'vitest'
import { Scribe } from '../src/index.ts'
import { fakeModel } from './fake-model.ts'

/**
 * The one call that happens before there is a city: somebody at the form asking
 * for a field to be written for them.
 *
 * What matters is that it only ever writes what was asked for, that what they
 * typed themselves survives the call, and that a model which will not answer
 * says nothing rather than handing back something canned.
 */

/** What the model answers: every field, whether or not it was the one asked for. */
const ANSWER = {
  theme: 'rain-soaked cargo port',
  brief: 'The container line shut last winter and the yards have been idle since, so the town lives on what is left in the sheds and on who still holds a key to them.',
  mainQuest: 'Find out who has been signing off on cargo that never arrived, and get the manifest out of the harbour office.',
  sideQuests: 'Fetching and carrying for the people still working the sheds, and settling debts nobody wants written down.',
  tone: 'guarded, dry, tired',
}

describe('writing the brief at the form', () => {
  it('writes only the fields it was asked for, and gives back what the owner typed', async () => {
    const { sent, sidecar } = fakeModel([ANSWER])
    const scribe = new Scribe({ sidecar })

    const written = await scribe.writeBrief({
      want: ['mainQuest'],
      have: { theme: 'high desert refinery town', tone: 'brisk' },
      seed: 'form',
    })

    expect(written?.mainQuest).toBe(ANSWER.mainQuest)
    // the model answered every field, as the tool asks it to; the two the owner
    // had typed come back theirs
    expect(written?.theme).toBe('high desert refinery town')
    expect(written?.tone).toBe('brisk')
    // and a field nobody had typed and nobody asked for takes the model's
    expect(written?.brief).toBe(ANSWER.brief)

    // the call names what was asked for, and shows what is already there
    expect(sent[0]?.toolName).toBe('write_brief')
    expect(sent[0]?.user).toContain('the main story')
    expect(sent[0]?.user).toContain('high desert refinery town')
  })

  it('tells the model the form is empty rather than sending it a list of nothing', async () => {
    const { sent, sidecar } = fakeModel([ANSWER])
    const scribe = new Scribe({ sidecar })

    await scribe.writeBrief({ want: ['theme', 'brief', 'mainQuest', 'sideQuests', 'tone'], seed: 'form' })

    expect(sent[0]?.user).toContain('The form is empty')
  })

  it('says nothing at all when the model will not answer, rather than composing one', async () => {
    const { sidecar } = fakeModel(['no-call'])
    const scribe = new Scribe({ sidecar })

    expect(await scribe.writeBrief({ want: ['brief'], seed: 'form' })).toBeUndefined()
    expect(scribe.problems().map((problem) => problem.task)).toContain('write_brief')
  })

  it('asks for nothing when nothing was wanted', async () => {
    const { sent, sidecar } = fakeModel([ANSWER])
    const scribe = new Scribe({ sidecar })

    expect(await scribe.writeBrief({ want: [], seed: 'form' })).toBeUndefined()
    expect(sent).toHaveLength(0)
  })

  it('describes every field of the tool it offers, because the schema is what is enforced', async () => {
    const { sent, sidecar } = fakeModel([ANSWER])
    const scribe = new Scribe({ sidecar })
    await scribe.writeBrief({ want: ['theme'], seed: 'form' })

    const properties = (sent[0]?.parameters as { properties: Record<string, { description?: string }> }).properties
    expect(Object.keys(properties).sort()).toEqual(['brief', 'mainQuest', 'sideQuests', 'theme', 'tone'])
    for (const [field, shape] of Object.entries(properties)) {
      expect(shape.description, `${field} reaches the model with no description`).toBeTruthy()
    }
  })
})
