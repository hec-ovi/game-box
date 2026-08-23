import { describe, expect, it } from 'vitest'
import type { Objective } from '../src/index.ts'
import { CRATES, HOLLIS, LEDGER, MARA, WITNESS, play, quest } from './fixture.ts'

const [first, second] = CRATES

function open(objectives: readonly Objective[], stepId: string): Objective {
  const found = objectives.find((objective) => objective.stepId === stepId)
  if (!found) throw new Error(`${stepId} is not on the board`)
  return found
}

/** Hear Mara out, walk to the warehouse, pick up a crate, carry it to Hollis. */
function errand(): unknown {
  return quest([
    { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
    { id: 'step_0002', kind: 'goto', place: { plotId: 'plot_0001' }, objective: 'Reach the warehouse', next: ['step_0003'] },
    {
      id: 'step_0003',
      kind: 'collect',
      itemId: first,
      alternates: [second],
      allowSteal: true,
      objective: 'Pick up a crate',
      next: ['step_0004'],
    },
    { id: 'step_0004', kind: 'deliver', itemId: first, alternates: [second], toNpcId: HOLLIS, objective: 'Carry it to Hollis', next: ['step_0005'] },
    { id: 'step_0005', kind: 'complete', objective: 'Done' },
  ])
}

describe('what an objective points at', () => {
  it('names the person a delivery is for, the place to walk to and the things that count', () => {
    const { log } = play(errand())
    log.start('quest_0001')
    expect(open(log.objectives(), 'step_0001').npcId).toBe(MARA)

    log.handle({ kind: 'talked', npcId: MARA })
    expect(open(log.objectives(), 'step_0002').place).toEqual({ plotId: 'plot_0001' })

    log.handle({ kind: 'arrived', place: { plotId: 'plot_0001' } })
    const pickUp = open(log.objectives(), 'step_0003')
    expect(pickUp.itemId).toBe(first)
    expect(pickUp.alternates).toEqual([second])

    log.handle({ kind: 'acquired', itemId: first })
    const handOver = open(log.objectives(), 'step_0004')
    expect(handOver.npcId).toBe(HOLLIS)
    expect(handOver.itemId).toBe(first)
  })

  it('points a stash at the interior and the spot inside it', () => {
    const { log } = play(
      quest([
        { id: 'step_0001', kind: 'collect', itemId: LEDGER, allowSteal: true, objective: 'Take the ledger', next: ['step_0002'] },
        {
          id: 'step_0002',
          kind: 'stash',
          itemId: LEDGER,
          interiorId: 'interior_0001',
          anchorId: 'anchor_0001',
          objective: 'Leave it under the counter',
          next: ['step_0003'],
        },
        { id: 'step_0003', kind: 'complete', objective: 'Done' },
      ]),
    )
    log.start('quest_0001')
    log.handle({ kind: 'acquired', itemId: LEDGER })

    const drop = open(log.objectives(), 'step_0002')
    expect(drop.place).toEqual({ interiorId: 'interior_0001' })
    expect(drop.anchorId).toBe('anchor_0001')
    expect(drop.itemId).toBe(LEDGER)
  })

  it('points an escort at the person to walk and at where to take them', () => {
    const { log } = play(
      quest([
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
      ]),
    )
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: WITNESS })

    const walk = open(log.objectives(), 'step_0002')
    expect(walk.npcId).toBe(WITNESS)
    expect(walk.place).toEqual({ plotId: 'plot_0001' })
  })
})
