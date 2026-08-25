import { describe, expect, it } from 'vitest'
import { WITNESS, play, quest } from './fixture.ts'

/** Talk the witness into coming, then walk them to the warehouse. */
function walkTheWitness(): unknown {
  return quest([
    {
      id: 'step_0001',
      kind: 'talk',
      npcId: WITNESS,
      objective: 'Talk the witness into coming',
      next: ['step_0002'],
      effects: [{ kind: 'companion-join', npcId: WITNESS }],
    },
    { id: 'step_0002', kind: 'escort', npcId: WITNESS, place: { plotId: 'plot_0001' }, objective: 'Walk them to the warehouse', next: ['step_0003'] },
    { id: 'step_0003', kind: 'complete', objective: 'Done' },
  ])
}

describe('escort', () => {
  it('credits when the companion arrives, never when the player arrives with the flag set', () => {
    const { log, player } = play(walkTheWitness())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: WITNESS })
    expect(player.isCompanion(WITNESS)).toBe(true)

    // the player is there and the record says the witness agreed to come: nobody walked
    log.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })
    expect(log.status('quest_0001')).toBe('active')

    // somebody else's body, or the right body somewhere else, is not the witness at the warehouse
    log.handle({ kind: 'companion-arrived', npcId: 'npc_0002', place: { plotId: 'plot_0001' } })
    log.handle({ kind: 'companion-arrived', npcId: WITNESS, place: { interiorId: 'interior_0001' } })
    expect(log.status('quest_0001')).toBe('active')

    const walked = log.handle({ kind: 'companion-arrived', npcId: WITNESS, place: { plotId: 'plot_0001' } })
    expect(walked.ok).toBe(true)
    if (walked.ok) expect(walked.value).toContainEqual({ kind: 'step-done', questId: 'quest_0001', stepId: 'step_0002' })
    expect(log.status('quest_0001')).toBe('complete')
  })
})
