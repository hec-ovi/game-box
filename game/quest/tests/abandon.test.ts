import { describe, expect, it } from 'vitest'
import { HOLLIS, LEDGER, MARA, play, quest, texts } from './fixture.ts'

/** Hear Mara out, take the ledger, hand it to Hollis. */
function fetchLedger(): unknown {
  return quest([
    { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
    { id: 'step_0002', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Take the ledger', next: ['step_0003'] },
    { id: 'step_0003', kind: 'deliver', itemId: LEDGER, toNpcId: HOLLIS, objective: 'Hand it to Hollis', next: ['step_0004'] },
    { id: 'step_0004', kind: 'complete', objective: 'Done' },
  ])
}

describe('giving a quest up', () => {
  it('clears the board, keeps what the player picked up, and lets the giver offer it again', () => {
    const { log, player } = play(fetchLedger())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    player.take(LEDGER)
    log.handle({ kind: 'acquired', itemId: LEDGER })
    player.adjustReputation(5)

    const given = log.abandon('quest_0001')
    expect(given.ok).toBe(true)
    if (given.ok) {
      expect(given.value).toContainEqual({ kind: 'step-abandoned', questId: 'quest_0001', stepId: 'step_0003' })
      expect(given.value.at(-1)).toEqual({ kind: 'quest-abandoned', questId: 'quest_0001' })
    }

    expect(log.objectives()).toEqual([])
    expect(log.status('quest_0001')).toBe('unstarted')
    expect(player.has(LEDGER)).toBe(true)
    expect(log.isQuestItem(LEDGER)).toBe(false)
    expect(player.money).toBe(0)
    expect(player.reputation()).toBe(5)

    expect(log.offeredBy(MARA).map((offer) => offer.id)).toEqual(['quest_0001'])
    expect(log.start('quest_0001').ok).toBe(true)
    expect(texts(log)).toEqual(['Hear Mara out'])
  })

  it('refuses a quest it does not know, and one nobody is playing', () => {
    const { log } = play(fetchLedger())
    const unknown = log.abandon('quest_0404')
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.error.code).toBe('unknown-quest')

    const unstarted = log.abandon('quest_0001')
    expect(unstarted.ok).toBe(false)
    if (!unstarted.ok && unstarted.error.code === 'not-active') expect(unstarted.error.status).toBe('unstarted')
    else throw new Error('expected not-active')

    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    log.handle({ kind: 'acquired', itemId: LEDGER })
    log.handle({ kind: 'gave', itemId: LEDGER, npcId: HOLLIS })
    expect(log.status('quest_0001')).toBe('complete')

    const finished = log.abandon('quest_0001')
    expect(finished.ok).toBe(false)
    if (!finished.ok && finished.error.code === 'not-active') expect(finished.error.status).toBe('complete')
    else throw new Error('expected not-active')
  })
})
