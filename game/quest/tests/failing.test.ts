import { describe, expect, it } from 'vitest'
import { HOLLIS, LEDGER, MARA, play, quest, refusal } from './fixture.ts'

/** A simple fetch, with whatever ends it badly bolted on. */
function underPressure(failWhen: readonly object[]): unknown {
  return quest(
    [
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
      { id: 'step_0002', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Take the ledger', next: ['step_0003'] },
      { id: 'step_0003', kind: 'deliver', itemId: LEDGER, toNpcId: HOLLIS, objective: 'Hand it to Hollis', next: ['step_0004'] },
      { id: 'step_0004', kind: 'complete', objective: 'Done' },
    ],
    { failWhen },
  )
}

describe('quests that fail on their own', () => {
  it('runs out of time, counting from the moment the quest was taken', () => {
    const { log } = play(underPressure([{ kind: 'time-limit', seconds: 120 }]))
    log.handle({ kind: 'clock', seconds: 1000 })
    log.start('quest_0001')

    log.handle({ kind: 'clock', seconds: 1090 })
    expect(log.status('quest_0001')).toBe('active')

    const late = log.handle({ kind: 'clock', seconds: 1121 })
    expect(late.ok).toBe(true)
    if (late.ok) expect(late.value).toContainEqual({ kind: 'quest-failed', questId: 'quest_0001', reason: 'time-limit' })
    expect(log.objectives()).toEqual([])
  })

  it('ends when the person it needs dies, and ignores them merely leaving', () => {
    const { log } = play(underPressure([{ kind: 'npc-lost', npcId: HOLLIS, reason: 'died' }]))
    log.start('quest_0001')

    log.handle({ kind: 'npc-gone', npcId: HOLLIS, reason: 'left' })
    expect(log.status('quest_0001')).toBe('active')

    const dead = log.handle({ kind: 'npc-gone', npcId: HOLLIS, reason: 'died' })
    expect(dead.ok).toBe(true)
    if (dead.ok) expect(dead.value).toContainEqual({ kind: 'quest-failed', questId: 'quest_0001', reason: 'npc-lost' })
  })

  it('ends when the thing it is about is destroyed', () => {
    const { log } = play(underPressure([{ kind: 'item-lost', itemId: LEDGER }]))
    log.start('quest_0001')
    const burnt = log.handle({ kind: 'item-destroyed', itemId: LEDGER })
    expect(burnt.ok).toBe(true)
    if (burnt.ok) expect(burnt.value).toContainEqual({ kind: 'quest-failed', questId: 'quest_0001', reason: 'item-lost' })
    expect(log.isQuestItem(LEDGER)).toBe(false)
  })

  it('says which step failed the quest when the flow reaches a fail step', () => {
    const doomed = quest([
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
      {
        id: 'step_0002',
        kind: 'choice',
        prompt: 'Hollis offers more.',
        objective: 'Decide',
        options: [
          { id: 'keep-word', label: 'Keep your word', next: 'step_0003' },
          { id: 'sell-out', label: 'Sell her out', next: 'step_0004' },
        ],
      },
      { id: 'step_0003', kind: 'complete', objective: 'Done' },
      { id: 'step_0004', kind: 'fail', objective: 'Mara will hear about this' },
    ])
    const { log } = play(doomed)
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    const sold = log.handle({ kind: 'chose', questId: 'quest_0001', stepId: 'step_0002', optionId: 'sell-out' })
    expect(sold.ok).toBe(true)
    if (sold.ok) expect(sold.value).toContainEqual({ kind: 'quest-failed', questId: 'quest_0001', reason: 'fail-step' })
  })

  it('refuses a failure rule about someone who is not in the world', () => {
    const { code, messages } = refusal(underPressure([{ kind: 'npc-lost', npcId: 'npc_0404' }]))
    expect(code).toBe('broken-flow')
    expect(messages).toContain('fails on unknown npc npc_0404')
  })
})
