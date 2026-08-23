import { describe, expect, it } from 'vitest'
import { HOLLIS, LEDGER, MARA, play, quest, refusal, texts } from './fixture.ts'

/** Steal the ledger or buy it. Either way Mara gets it. */
function stealOrBuy(): unknown {
  return quest([
    { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
    { id: 'step_0002', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Lift the ledger', next: ['step_0004'] },
    {
      id: 'step_0003',
      kind: 'talk',
      npcId: HOLLIS,
      topic: 'price',
      objective: 'Buy the ledger from Hollis',
      next: ['step_0004'],
      effects: [
        { kind: 'charge', amount: 20 },
        { kind: 'give-item', itemId: LEDGER },
      ],
    },
    { id: 'step_0004', kind: 'any-of', oneOf: ['step_0002', 'step_0003'], objective: 'However you got it', next: ['step_0005'] },
    { id: 'step_0005', kind: 'deliver', itemId: LEDGER, toNpcId: MARA, objective: 'Take it to Mara', next: ['step_0006'] },
    { id: 'step_0006', kind: 'complete', objective: 'Done' },
  ])
}

describe('any-of', () => {
  it('drops the branches the player did not take', () => {
    const { log, player } = play(stealOrBuy(), 50)
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    expect(texts(log)).toEqual(['Buy the ledger from Hollis', 'Lift the ledger'])

    const bought = log.handle({ kind: 'talked', npcId: HOLLIS, topic: 'price' })
    expect(bought.ok).toBe(true)
    if (bought.ok) expect(bought.value).toContainEqual({ kind: 'step-abandoned', questId: 'quest_0001', stepId: 'step_0002' })

    expect(texts(log)).toEqual(['Take it to Mara'])
    expect(player.money).toBe(30)
    expect(player.has(LEDGER)).toBe(true)

    // the dropped branch is dead: lifting the ledger now moves nothing
    log.handle({ kind: 'acquired', itemId: LEDGER, stolen: true })
    expect(texts(log)).toEqual(['Take it to Mara'])

    log.handle({ kind: 'gave', itemId: LEDGER, npcId: MARA })
    expect(log.status('quest_0001')).toBe('complete')
  })

  it('only guarantees what every alternative guarantees', () => {
    const oneEmptyHanded = quest([
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
      { id: 'step_0002', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Lift the ledger', next: ['step_0004'] },
      { id: 'step_0003', kind: 'talk', npcId: HOLLIS, objective: 'Ask nicely and get nothing', next: ['step_0004'] },
      { id: 'step_0004', kind: 'any-of', oneOf: ['step_0002', 'step_0003'], objective: 'Either way', next: ['step_0005'] },
      { id: 'step_0005', kind: 'deliver', itemId: LEDGER, toNpcId: MARA, objective: 'Take it to Mara', next: ['step_0006'] },
      { id: 'step_0006', kind: 'complete', objective: 'Done' },
    ])
    const { code, messages } = refusal(oneEmptyHanded)
    expect(code).toBe('broken-flow')
    expect(messages.join(' ')).toContain('before the player is guaranteed to have it')
  })

  it('refuses a branch that may never be done and one that does not lead to it', () => {
    const optionalBranch = quest([
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
      { id: 'step_0002', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Lift the ledger', next: ['step_0004'] },
      { id: 'step_0003', kind: 'talk', npcId: HOLLIS, optional: true, objective: 'Chat, maybe', next: ['step_0004'] },
      { id: 'step_0004', kind: 'any-of', oneOf: ['step_0002', 'step_0003'], objective: 'Either way', next: ['step_0005'] },
      { id: 'step_0005', kind: 'complete', objective: 'Done' },
    ])
    expect(refusal(optionalBranch).messages).toContain('offers step_0003, which is optional and may never be done')

    const stray = quest([
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
      { id: 'step_0002', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Lift the ledger', next: ['step_0004'] },
      { id: 'step_0003', kind: 'talk', npcId: HOLLIS, objective: 'Ask around', next: ['step_0005'] },
      { id: 'step_0004', kind: 'any-of', oneOf: ['step_0002', 'step_0003'], objective: 'Either way', next: ['step_0005'] },
      { id: 'step_0005', kind: 'complete', objective: 'Done' },
    ])
    expect(refusal(stray).messages).toContain(
      'offers step_0003, but step_0003 does not lead to it: every branch needs this step in its next, and needs to be reachable from the first step',
    )
  })
})
