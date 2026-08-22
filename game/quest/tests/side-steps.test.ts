import { describe, expect, it } from 'vitest'
import { HOLLIS, LEDGER, MARA, play, quest, refusal, texts } from './fixture.ts'

/** Report to Hollis. The ledger sitting in the warehouse is a secret worth pocketing on the way. */
function withSecret(): unknown {
  return quest([
    { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
    {
      id: 'step_0002',
      kind: 'goto',
      place: { plotId: 'plot_0001' },
      objective: 'Reach the warehouse',
      next: ['step_0004'],
      effects: [{ kind: 'reveal', stepId: 'step_0003' }],
    },
    {
      id: 'step_0003',
      kind: 'collect',
      itemId: LEDGER,
      allowSteal: true,
      optional: true,
      hidden: true,
      objective: 'Pocket the ledger while you are in there',
      effects: [{ kind: 'pay', amount: 20 }],
    },
    { id: 'step_0004', kind: 'talk', npcId: HOLLIS, objective: 'Report to Hollis', next: ['step_0005'] },
    { id: 'step_0005', kind: 'complete', objective: 'Done' },
  ])
}

describe('optional steps', () => {
  it('lets an optional step be a dead end and finishes the quest without it', () => {
    const { log, player } = play(withSecret())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    log.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })

    const secret = log.objectives().find((objective) => objective.stepId === 'step_0003')
    expect(secret?.optional).toBe(true)
    expect(log.objectives().find((objective) => objective.stepId === 'step_0004')?.optional).toBeUndefined()

    log.handle({ kind: 'talked', npcId: HOLLIS })
    expect(log.status('quest_0001')).toBe('complete')
    expect(player.money).toBe(45) // the reward, not the 20 the secret would have paid
  })

  it('refuses a quest whose only way to finish runs through optional work', () => {
    const sideways = quest([
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
      { id: 'step_0002', kind: 'goto', place: { plotId: 'plot_0001' }, optional: true, objective: 'Wander over', next: ['step_0003'] },
      { id: 'step_0003', kind: 'complete', objective: 'Done' },
    ])
    const { code, messages } = refusal(sideways)
    expect(code).toBe('broken-flow')
    expect(messages).toContain('required, but only reachable through optional steps')
    expect(messages).toContain('no path reaches a complete step')
  })
})

describe('hidden steps', () => {
  it('keeps a secret off the board until something reveals it', () => {
    const { log } = play(withSecret())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    expect(texts(log)).toEqual(['Reach the warehouse'])

    const arrived = log.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })
    expect(arrived.ok).toBe(true)
    if (arrived.ok) {
      expect(arrived.value).toContainEqual({
        kind: 'step-revealed',
        questId: 'quest_0001',
        stepId: 'step_0003',
        objective: 'Pocket the ledger while you are in there',
      })
    }
    expect(texts(log)).toEqual(['Pocket the ledger while you are in there', 'Report to Hollis'])
  })

  it('refuses a secret nothing ever shows, and a reveal aimed at a step that is not hidden', () => {
    const unrevealed = quest([
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0003'] },
      { id: 'step_0002', kind: 'talk', npcId: HOLLIS, objective: 'Report to Hollis', next: ['step_0004'] },
      { id: 'step_0003', kind: 'collect', itemId: LEDGER, optional: true, hidden: true, objective: 'Never shown' },
      { id: 'step_0004', kind: 'complete', objective: 'Done' },
    ])
    expect(refusal(unrevealed).messages).toContain('hidden, but nothing reveals it')

    const pointless = quest([
      {
        id: 'step_0001',
        kind: 'talk',
        npcId: MARA,
        objective: 'Hear Mara out',
        next: ['step_0002'],
        effects: [{ kind: 'reveal', stepId: 'step_0002' }],
      },
      { id: 'step_0002', kind: 'complete', objective: 'Done' },
    ])
    expect(refusal(pointless).messages).toContain('reveals step_0002, which is not hidden')
  })
})
