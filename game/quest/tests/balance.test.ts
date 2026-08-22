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

  it('refuses a fortune for an errand and pocket change for a hard job', () => {
    const fortune = refusal(job({ money: 40000, reputation: 0, faction: 'town', items: [] }, { difficulty: 'errand' }))
    expect(fortune.code).toBe('unbalanced-reward')
    expect(fortune.messages).toContain('reward.money: an errand pays at most 25, this hands over 40000')

    const stingy = refusal(job({ money: 4, reputation: 0, faction: 'town', items: [] }, { difficulty: 'hard' }))
    expect(stingy.code).toBe('unbalanced-reward')
    expect(stingy.messages).toContain('reward.money: a hard job pays at least 200, this rewards 4')
  })

  it('counts money handed over mid-quest against the same ceiling', () => {
    const smuggled = refusal(
      job({ money: 20, reputation: 0, faction: 'town', items: [] }, { step_0003: { effects: [{ kind: 'pay', amount: 900 }] } }),
    )
    expect(smuggled.code).toBe('unbalanced-reward')
    expect(smuggled.messages).toContain('reward.money: a small job pays at most 90, this hands over 920')
  })

  it('refuses a standing swing and an item pile the tier cannot carry', () => {
    const swing = refusal(job({ money: 20, reputation: 50, faction: 'town', items: [] }))
    expect(swing.messages).toContain('reward.reputation: a small job moves reputation by at most 12, this moves it by 50')

    const pile = refusal(job({ money: 20, reputation: 0, faction: 'town', items: ['item_0001', 'item_0002'] }))
    expect(pile.messages).toContain('reward.items: a small job rewards at most 1 item(s), this rewards 2')
  })
})
