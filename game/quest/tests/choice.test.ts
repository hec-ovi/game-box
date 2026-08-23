import { describe, expect, it } from 'vitest'
import type { JournalStep, Objective, QuestLog } from '../src/index.ts'
import { HOLLIS, LEDGER, MARA, play, quest } from './fixture.ts'

function open(log: QuestLog, stepId: string): Objective {
  const found = log.objectives().find((objective) => objective.stepId === stepId)
  if (!found) throw new Error(`${stepId} is not on the board`)
  return found
}

function pageStep(log: QuestLog, stepId: string): JournalStep | undefined {
  return log.journal().find((entry) => entry.questId === 'quest_0001')?.steps.find((step) => step.stepId === stepId)
}

/** Everything the player can read right now, objectives panel and quests tab together. */
function onScreen(log: QuestLog): string {
  return JSON.stringify([log.objectives(), log.journal()])
}

/** Mara wants the ledger back, Hollis has offered more for it: one question, two roads. */
function crossroads(): unknown {
  return quest([
    { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
    {
      id: 'step_0002',
      kind: 'choice',
      objective: 'Decide who gets the ledger',
      prompt: 'Hollis is offering more than Mara did. Whose is it?',
      options: [
        { id: 'keep-word', label: 'Keep your word to Mara', next: 'step_0003' },
        { id: 'sell-out', label: 'Sell it to Hollis', next: 'step_0004' },
      ],
    },
    { id: 'step_0003', kind: 'talk', npcId: MARA, topic: 'the ledger', objective: 'Tell Mara it is hers', next: ['step_0005'] },
    { id: 'step_0004', kind: 'talk', npcId: HOLLIS, topic: 'the price', objective: 'Take Hollis his bargain', next: ['step_0005'] },
    { id: 'step_0005', kind: 'complete', objective: 'Done' },
  ])
}

/** The same two roads, except nobody knows the question is coming until the warehouse door is open. */
function secretCrossroads(): unknown {
  return quest([
    { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
    {
      id: 'step_0002',
      kind: 'goto',
      place: { plotId: 'plot_0001' },
      objective: 'Reach the warehouse',
      next: ['step_0004'],
      effects: [{ kind: 'reveal', stepId: 'step_0003' }],
    },
    {
      id: 'step_0003',
      kind: 'choice',
      hidden: true,
      optional: true,
      objective: 'Decide what happens to the ledger',
      prompt: 'The ledger is lying right there. Burn it, or pocket it?',
      options: [
        { id: 'burn', label: 'Burn it', next: 'step_0005' },
        { id: 'pocket', label: 'Pocket it', next: 'step_0006' },
      ],
    },
    { id: 'step_0004', kind: 'talk', npcId: HOLLIS, objective: 'Report to Hollis', next: ['step_0007'] },
    { id: 'step_0005', kind: 'talk', npcId: MARA, topic: 'the fire', optional: true, objective: 'Own up to Mara' },
    { id: 'step_0006', kind: 'collect', itemId: LEDGER, allowSteal: true, optional: true, objective: 'Keep it for yourself' },
    { id: 'step_0007', kind: 'complete', objective: 'Done' },
  ])
}

describe('a choice the player makes', () => {
  it('publishes the question and the roads, and takes back the key it published', () => {
    const { log } = play(crossroads())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })

    const decision = open(log, 'step_0002')
    expect(decision.choice).toEqual({
      prompt: 'Hollis is offering more than Mara did. Whose is it?',
      options: [
        { key: 'keep-word', label: 'Keep your word to Mara' },
        { key: 'sell-out', label: 'Sell it to Hollis' },
      ],
    })

    const sellOut = decision.choice!.options[1]!
    log.handle({ kind: 'chose', questId: 'quest_0001', stepId: decision.stepId, optionId: sellOut.key })
    expect(log.objectives().map((objective) => objective.text)).toEqual(['Take Hollis his bargain'])
  })

  it('leaves the question standing when the answer names a road it never offered', () => {
    const { log } = play(crossroads())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })

    const moved = log.handle({ kind: 'chose', questId: 'quest_0001', stepId: 'step_0002', optionId: 'Sell it to Hollis' })
    expect(moved).toEqual({ ok: true, value: [] })
    expect(open(log, 'step_0002').choice?.options.map((option) => option.key)).toEqual(['keep-word', 'sell-out'])
  })

  it('says nothing about where a road goes, and nothing at all while the question is a secret', () => {
    const { log } = play(secretCrossroads())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })

    // the choice is on the board, and the player has not been told it exists
    expect(log.objectives().map((objective) => objective.stepId)).toEqual(['step_0002'])
    expect(pageStep(log, 'step_0003')).toBeUndefined()
    expect(onScreen(log)).not.toContain('Burn it')
    expect(onScreen(log)).not.toContain('Pocket it')

    // revealed, the question reaches both surfaces
    log.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })
    const decision = open(log, 'step_0003')
    expect(decision.choice?.options.map((option) => option.key)).toEqual(['burn', 'pocket'])
    expect(pageStep(log, 'step_0003')?.choice?.prompt).toBe('The ledger is lying right there. Burn it, or pocket it?')

    // and the roads out of it are still the player's to find out
    expect(JSON.stringify(decision)).not.toContain('step_0005')
    expect(JSON.stringify(decision)).not.toContain('Own up to Mara')
  })
})
