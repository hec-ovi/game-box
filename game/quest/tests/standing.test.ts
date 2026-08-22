import { describe, expect, it } from 'vitest'
import { HOLLIS, LEDGER, MARA, play, quest, texts } from './fixture.ts'

const DOCKERS = 'dockers'

/** Nobody on the docks hands this job to a stranger. */
function dockWork(): unknown {
  return quest(
    [
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
      { id: 'step_0002', kind: 'complete', objective: 'Done' },
    ],
    { requires: [{ kind: 'reputation-at-least', faction: DOCKERS, amount: 20 }] },
  )
}

describe('standing', () => {
  it('keeps a quest off the table until the player is known well enough', () => {
    const { log, player } = play(dockWork())
    expect(log.offeredBy(MARA)).toEqual([])

    const refused = log.start('quest_0001')
    expect(refused.ok).toBe(false)
    if (!refused.ok && refused.error.code === 'requirements-not-met') {
      expect(refused.error.unmet).toEqual([{ kind: 'reputation-at-least', faction: DOCKERS, amount: 20 }])
    } else {
      throw new Error('expected requirements-not-met')
    }

    player.adjustReputation(25, DOCKERS)
    expect(log.offeredBy(MARA).map((q) => q.id)).toEqual(['quest_0001'])
    expect(log.start('quest_0001').ok).toBe(true)
  })

  it('holds shady work back until the player is disliked enough for it', () => {
    const shady = quest([
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
      {
        id: 'step_0002',
        kind: 'collect',
        itemId: LEDGER,
        allowSteal: true,
        objective: 'Lift the ledger',
        requires: [{ kind: 'reputation-below', faction: 'town', amount: 0 }],
        next: ['step_0003'],
      },
      { id: 'step_0003', kind: 'deliver', itemId: LEDGER, toNpcId: HOLLIS, objective: 'Hand it over', next: ['step_0004'] },
      { id: 'step_0004', kind: 'complete', objective: 'Done' },
    ])
    const { log, player } = play(shady)
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })

    player.adjustReputation(5)
    log.handle({ kind: 'acquired', itemId: LEDGER, stolen: true })
    expect(texts(log)).toEqual(['Lift the ledger'])

    player.adjustReputation(-10)
    log.handle({ kind: 'acquired', itemId: LEDGER, stolen: true })
    expect(texts(log)).toEqual(['Hand it over'])
  })
})
