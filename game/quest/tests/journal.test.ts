import { describe, expect, it } from 'vitest'
import type { JournalEntry, QuestLog } from '../src/index.ts'
import { HOLLIS, LEDGER, MARA, WITNESS, play, quest } from './fixture.ts'

function page(log: QuestLog, questId = 'quest_0001'): JournalEntry {
  const found = log.journal().find((entry) => entry.questId === questId)
  if (!found) throw new Error(`${questId} has no page`)
  return found
}

/** Every step of the page as "id: state", in the order the page lists them. */
function states(log: QuestLog, questId = 'quest_0001'): string[] {
  return page(log, questId).steps.map((step) => `${step.stepId}: ${step.state}`)
}

/** Hear Mara out, then lift the ledger and talk the witness round, then take it to Mara. */
function twoBranches(): unknown {
  return quest([
    { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
    { id: 'step_0002', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Lift the ledger', next: ['step_0004'] },
    { id: 'step_0003', kind: 'talk', npcId: WITNESS, objective: 'Talk the witness round', next: ['step_0004'] },
    { id: 'step_0004', kind: 'join', waitFor: ['step_0002', 'step_0003'], objective: 'Both done', next: ['step_0005'] },
    { id: 'step_0005', kind: 'deliver', itemId: LEDGER, toNpcId: MARA, objective: 'Take it to Mara', next: ['step_0006'] },
    { id: 'step_0006', kind: 'complete', objective: 'Done' },
  ])
}

describe('the journal', () => {
  it('says of every step whether it is done, open now or still to come', () => {
    const { log } = play(twoBranches())
    log.start('quest_0001')
    expect(states(log)).toEqual([
      'step_0001: open',
      'step_0002: upcoming',
      'step_0003: upcoming',
      'step_0004: upcoming',
      'step_0005: upcoming',
      'step_0006: upcoming',
    ])

    log.handle({ kind: 'talked', npcId: MARA })
    expect(states(log)).toEqual([
      'step_0001: done',
      'step_0002: open',
      'step_0003: open',
      'step_0004: upcoming',
      'step_0005: upcoming',
      'step_0006: upcoming',
    ])
  })

  it('lists the steps the way the quest was written, not the way the player finished them', () => {
    const { log } = play(twoBranches())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })

    // the second branch first, so completion order and document order disagree
    log.handle({ kind: 'talked', npcId: WITNESS })
    log.handle({ kind: 'acquired', itemId: LEDGER, stolen: true })

    expect(page(log).steps.map((step) => step.stepId)).toEqual(['step_0001', 'step_0002', 'step_0003', 'step_0004', 'step_0005', 'step_0006'])
  })

  it('drops the far side of a choice once the player has gone the other way', () => {
    const { log } = play(
      quest([
        { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
        {
          id: 'step_0002',
          kind: 'choice',
          prompt: 'Whose side are you on?',
          objective: 'Pick a side',
          options: [
            { id: 'mara', label: "Mara's", next: 'step_0003' },
            { id: 'hollis', label: "Hollis's", next: 'step_0004' },
          ],
        },
        { id: 'step_0003', kind: 'talk', npcId: MARA, topic: 'the deal', objective: 'Tell Mara she has you', next: ['step_0005'] },
        { id: 'step_0004', kind: 'talk', npcId: HOLLIS, topic: 'the deal', objective: 'Tell Hollis he has you', next: ['step_0005'] },
        { id: 'step_0005', kind: 'complete', objective: 'Done' },
      ]),
    )
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    log.handle({ kind: 'chose', questId: 'quest_0001', stepId: 'step_0002', optionId: 'mara' })

    expect(states(log)).toEqual([
      'step_0001: done',
      'step_0002: done',
      'step_0003: open',
      'step_0004: dropped',
      'step_0005: upcoming',
    ])
  })

  it('drops a rival branch once another one has won the any-of', () => {
    const { log } = play(
      quest([
        { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
        { id: 'step_0002', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Lift the ledger', next: ['step_0004'] },
        {
          id: 'step_0003',
          kind: 'talk',
          npcId: HOLLIS,
          topic: 'price',
          objective: 'Buy the ledger from Hollis',
          next: ['step_0004'],
          effects: [{ kind: 'give-item', itemId: LEDGER }],
        },
        { id: 'step_0004', kind: 'any-of', oneOf: ['step_0002', 'step_0003'], objective: 'However you got it', next: ['step_0005'] },
        { id: 'step_0005', kind: 'deliver', itemId: LEDGER, toNpcId: MARA, objective: 'Take it to Mara', next: ['step_0006'] },
        { id: 'step_0006', kind: 'complete', objective: 'Done' },
      ]),
    )
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    log.handle({ kind: 'talked', npcId: HOLLIS, topic: 'price' })

    expect(states(log)).toEqual([
      'step_0001: done',
      'step_0002: dropped',
      'step_0003: done',
      'step_0004: done',
      'step_0005: open',
      'step_0006: upcoming',
    ])
  })

  it('keeps a secret off the page until something reveals it', () => {
    const { log } = play(
      quest([
        { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
        {
          id: 'step_0002',
          kind: 'goto',
          place: { plotId: 'plot_0001' },
          objective: 'Reach the warehouse',
          next: ['step_0004'],
          effects: [{ kind: 'reveal', stepId: 'step_0003' }],
        },
        { id: 'step_0003', kind: 'collect', itemId: LEDGER, allowSteal: true, optional: true, hidden: true, objective: 'Pocket the ledger' },
        { id: 'step_0004', kind: 'talk', npcId: HOLLIS, objective: 'Report to Hollis', next: ['step_0005'] },
        { id: 'step_0005', kind: 'complete', objective: 'Done' },
      ]),
    )
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    expect(states(log)).toEqual(['step_0001: done', 'step_0002: open', 'step_0004: upcoming', 'step_0005: upcoming'])

    log.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })
    expect(states(log)).toEqual(['step_0001: done', 'step_0002: done', 'step_0003: open', 'step_0004: open', 'step_0005: upcoming'])
  })

  it('gives a page only to quests the player has taken, and keeps it once the quest is over', () => {
    const { log } = play(
      quest([
        { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
        { id: 'step_0002', kind: 'talk', npcId: WITNESS, optional: true, objective: 'Ask the witness what she saw' },
        { id: 'step_0003', kind: 'complete', objective: 'Done' },
      ]),
    )
    expect(log.journal()).toEqual([])

    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    expect(page(log).status).toBe('complete')
    expect(states(log)).toEqual(['step_0001: done', 'step_0002: dropped', 'step_0003: done'])
  })

  it('carries the same line an objective carries, so a step reads the same in both', () => {
    const { log } = play(
      quest([
        {
          id: 'step_0001',
          kind: 'collect',
          itemId: LEDGER,
          count: 1,
          allowSteal: true,
          objective: 'Take the ledger',
          markerLabel: 'The ledger',
          hint: 'Hollis keeps it in the back',
          next: ['step_0002'],
        },
        { id: 'step_0002', kind: 'complete', objective: 'Done' },
      ]),
    )
    log.start('quest_0001')

    const [objective] = log.objectives()
    const { questId, questTitle, ...line } = objective!
    expect(page(log).steps[0]).toEqual({ ...line, state: 'open' })
  })
})
