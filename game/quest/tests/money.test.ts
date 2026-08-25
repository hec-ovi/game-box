import { describe, expect, it } from 'vitest'
import { MARA, play, quest } from './fixture.ts'

/** The money port to `@gb/play`: `pay` is `earn`, `charge` is `pay`. */
function paidThenCharged(charge: number): unknown {
  return quest([
    { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Take the advance', next: ['step_0002'], effects: [{ kind: 'pay', amount: 15 }] },
    { id: 'step_0002', kind: 'talk', npcId: MARA, topic: 'fee', objective: 'Pay the fee', next: ['step_0003'], effects: [{ kind: 'charge', amount: charge }] },
    { id: 'step_0003', kind: 'complete', objective: 'Done' },
  ])
}

describe('money effects', () => {
  it('a pay effect earns, a charge effect pays', () => {
    const { log, player } = play(paidThenCharged(10), 5)
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    expect(player.money).toBe(20)
    log.handle({ kind: 'talked', npcId: MARA, topic: 'fee' })
    expect(player.money).toBe(20 - 10 + 45) // the fee left, the reward arrived
  })

  it('a charge the player cannot cover deducts nothing', () => {
    const { log, player } = play(paidThenCharged(80), 5)
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    log.handle({ kind: 'talked', npcId: MARA, topic: 'fee' })
    expect(player.money).toBe(20 + 45)
  })
})
