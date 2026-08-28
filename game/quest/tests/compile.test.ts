import { describe, expect, it } from 'vitest'
import { compileQuest, rewardFor, validateQuest, type QuestDoc } from '../src/index.ts'
import { CRATES, HOLLIS, LEDGER, MARA, WITNESS, world } from './fixture.ts'

/** A sheet as a writer hands it over: the story, and nothing about the flow. */
function sheet(beats: readonly object[], overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'quest_0001',
    kind: 'side',
    title: 'The Missing Ledger',
    summary: 'Mara wants what Hollis keeps in the warehouse.',
    giverNpcId: MARA,
    beats,
    reward: rewardFor('small'),
    ...overrides,
  }
}

function compiled(beats: readonly object[], overrides: Record<string, unknown> = {}): QuestDoc {
  const result = compileQuest(sheet(beats, overrides), world)
  if (!result.ok) throw new Error(`the sheet was refused: ${JSON.stringify(result.error)}`)
  return result.value.quest
}

/** Every reason a sheet was turned down, as the words a writer gets back. */
function refused(beats: readonly object[], overrides: Record<string, unknown> = {}): string[] {
  const result = compileQuest(sheet(beats, overrides), world)
  if (result.ok) return []
  if (result.error.code === 'unwritable-beat') {
    return result.error.problems.map((problem) => `${problem.where}: ${problem.message}`)
  }
  return result.error.violations.map((violation) => `${violation.path}: ${violation.message}`)
}

const kinds = (quest: QuestDoc) => quest.steps.map((step) => step.kind)

describe('compiling beats into a flow', () => {
  it('puts the pick-up in front of the hand-over that needs it, whatever order the beats came in', () => {
    // the writer told it back to front: Mara is handed the ledger before anybody fetched it
    const quest = compiled([
      { kind: 'talk', npcId: HOLLIS, objective: 'Hear Hollis out' },
      { kind: 'deliver', itemId: LEDGER, toNpcId: MARA, objective: 'Give Mara the ledger' },
      { kind: 'collect', itemId: LEDGER, objective: 'Take the ledger off the desk' },
    ])

    expect(kinds(quest)).toEqual(['talk', 'collect', 'deliver', 'complete'])
    // the writer's own line survives the move
    expect(quest.steps[1]).toMatchObject({ kind: 'collect', objective: 'Take the ledger off the desk' })
    expect(validateQuest(quest, world).ok).toBe(true)
  })

  it('writes the pick-up itself when no beat picks the thing up at all', () => {
    const quest = compiled([{ kind: 'deliver', itemId: LEDGER, toNpcId: MARA, objective: 'Give Mara the ledger' }])

    expect(kinds(quest)).toEqual(['collect', 'deliver', 'complete'])
    // and says what it is for, so the line the writer did give is still on the page
    expect(quest.steps[0]).toMatchObject({ kind: 'collect', itemId: LEDGER, hint: 'Give Mara the ledger' })
    expect(validateQuest(quest, world).ok).toBe(true)
  })

  it('asks somebody to come along before walking them anywhere', () => {
    const quest = compiled([{ kind: 'escort', npcId: WITNESS, where: { plotId: 'plot_0001' }, objective: 'Walk the witness to the depot' }])

    expect(kinds(quest)).toEqual(['talk', 'escort', 'complete'])
    expect(quest.steps[0]).toMatchObject({ npcId: WITNESS, effects: [{ kind: 'companion-join', npcId: WITNESS }] })
    expect(validateQuest(quest, world).ok).toBe(true)
  })

  it('forks a choice into its roads and brings them back together', () => {
    const quest = compiled([
      { kind: 'collect', itemId: CRATES[0], objective: 'Take the crate' },
      {
        kind: 'choice',
        prompt: 'Hollis is offering more than Mara did. Whose is it?',
        objective: 'Decide who gets the crate',
        options: [
          { label: 'Keep your word to Mara', beats: [{ kind: 'deliver', itemId: CRATES[0], toNpcId: MARA, objective: 'Give Mara the crate' }] },
          { label: 'Sell it to Hollis', beats: [{ kind: 'deliver', itemId: CRATES[0], toNpcId: HOLLIS, objective: 'Give Hollis the crate' }] },
        ],
      },
      { kind: 'talk', npcId: WITNESS, objective: 'Tell the witness it is done' },
    ])

    const fork = quest.steps.find((step) => step.kind === 'choice')!
    expect(fork.kind === 'choice' && fork.options.map((option) => option.label)).toEqual([
      'Keep your word to Mara',
      'Sell it to Hollis',
    ])
    // both roads run their own work and both end up at the same next beat
    const roads = fork.kind === 'choice' ? fork.options.map((option) => option.next) : []
    const after = new Set(roads.map((id) => quest.steps.find((step) => step.id === id)!.next.join()))
    expect(roads).toHaveLength(2)
    expect(after.size).toBe(1)
    expect(kinds(quest)).toEqual(['collect', 'choice', 'deliver', 'deliver', 'talk', 'complete'])
    expect(validateQuest(quest, world).ok).toBe(true)
  })

  it('refuses a beat that names somebody the world has not got, and says which id', () => {
    const problems = refused([{ kind: 'talk', npcId: 'npc_9999', objective: 'Ask the fixer' }])

    expect(problems).toEqual(['beats.0: npc npc_9999 is not in the world'])
  })

  it('settles the pay into the band the work belongs to', () => {
    // a home is epic work, and 150 credits sits under the floor of any tier that hands one over
    const quest = compiled([{ kind: 'talk', npcId: HOLLIS, objective: 'Sign for the place' }], {
      reward: { money: 150, reputation: 3, faction: 'town', items: [], deed: 'interior_0001' },
    })

    expect(quest.difficulty).toBe('epic')
    expect(quest.reward.money).toBe(600)
  })
})
