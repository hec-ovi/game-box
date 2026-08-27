import { describe, expect, it } from 'vitest'
import { REWARD_TABLE, rewardFor } from '../src/index.ts'
import { HOLLIS, LEDGER, MARA, accept, quest, refusal } from './fixture.ts'

/** Walk across town, hand over a ledger, get paid whatever the test says. */
function job(reward: object, overrides: Record<string, unknown> = {}): unknown {
  return quest(
    [
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
      { id: 'step_0002', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Take the ledger', next: ['step_0003'] },
      {
        id: 'step_0003',
        kind: 'deliver',
        itemId: LEDGER,
        toNpcId: HOLLIS,
        objective: 'Hand it to Hollis',
        next: ['step_0004'],
        ...(overrides['step_0003'] as object | undefined),
      },
      { id: 'step_0004', kind: 'complete', objective: 'Done' },
    ],
    { reward, ...overrides },
  )
}

describe('reward balance', () => {
  it('gives a generator a reward that fits the difficulty it asked for', () => {
    const reward = rewardFor('standard')
    expect(reward.money).toBe(REWARD_TABLE.standard.typical.money)
    expect(accept(job(reward, { difficulty: 'standard' })).reward.money).toBe(140)
  })

  it('settles a fortune and pocket change into the band instead of refusing the job', () => {
    // a number in the wrong place is not a reason to throw a playable job away
    const fortune = accept(job({ money: 40000, reputation: 0, faction: 'town', items: [] }, { difficulty: 'errand' }))
    expect(fortune.reward.money).toBe(REWARD_TABLE.errand.money.max)

    const stingy = accept(job({ money: 4, reputation: 0, faction: 'town', items: [] }, { difficulty: 'hard' }))
    expect(stingy.reward.money).toBe(REWARD_TABLE.hard.money.min)
  })

  it('counts money handed over mid-quest against the same ceiling', () => {
    const smuggled = accept(
      job({ money: 20, reputation: 0, faction: 'town', items: [] }, { step_0003: { effects: [{ kind: 'pay', amount: 900 }] } }),
    )
    // the steps already hand over more than a small job may, so the pay at the end is nothing
    expect(smuggled.reward.money).toBe(0)
  })

  it('settles a standing swing, and still refuses an item pile the tier cannot carry', () => {
    const swing = accept(job({ money: 20, reputation: 50, faction: 'town', items: [] }))
    expect(swing.reward.reputation).toBe(REWARD_TABLE.small.reputation)

    const pile = refusal(job({ money: 20, reputation: 0, faction: 'town', items: ['item_0001', 'item_0002'] }))
    expect(pile.messages).toContain('reward.items: a small job rewards at most 1 item(s), this rewards 2')
  })
})
