import { describe, expect, it } from 'vitest'
import { CRATES, HOLLIS, LEDGER, play, quest } from './fixture.ts'

const [first, second, third] = CRATES

/** Buy two of three crates off the counter, hand them to Hollis. */
function shopping(): unknown {
  return quest([
    { id: 'step_0001', kind: 'buy', itemId: first, alternates: [second, third], count: 2, objective: 'Buy two crates', next: ['step_0002'] },
    { id: 'step_0002', kind: 'deliver', itemId: first, alternates: [second, third], count: 2, toNpcId: HOLLIS, objective: 'Bring them to Hollis', next: ['step_0003'] },
    { id: 'step_0003', kind: 'complete', objective: 'Done' },
  ])
}

describe('buying', () => {
  it('counts what was paid for, never what was merely picked up, and the purchase covers the delivery', () => {
    const { log } = play(shopping())
    log.start('quest_0001')
    const line = log.objectives()[0]!
    expect(line.itemId).toBe(first)
    expect(line.alternates).toEqual([second, third])
    expect(line.count).toEqual({ done: 0, needed: 2 })

    // in hand, but not paid for: a buy step is not a collect step
    log.handle({ kind: 'acquired', itemId: first })
    expect(log.objectives()[0]!.count).toEqual({ done: 0, needed: 2 })
    log.handle({ kind: 'bought', itemId: LEDGER })
    expect(log.objectives()[0]!.count).toEqual({ done: 0, needed: 2 })

    log.handle({ kind: 'bought', itemId: second })
    expect(log.objectives()[0]!.count).toEqual({ done: 1, needed: 2 })
    log.handle({ kind: 'bought', itemId: second })
    expect(log.objectives()[0]!.count).toEqual({ done: 1, needed: 2 })
    log.handle({ kind: 'bought', itemId: third })
    expect(log.objectives()[0]!.stepId).toBe('step_0002')

    log.handle({ kind: 'gave', itemId: second, npcId: HOLLIS })
    log.handle({ kind: 'gave', itemId: third, npcId: HOLLIS })
    expect(log.status('quest_0001')).toBe('complete')
  })
})
