import { describe, expect, it } from 'vitest'
import { questDraftContract, sealQuest } from '../src/index.ts'
import { LEDGER, MARA, accept, draft } from './fixture.ts'

describe('the draft door', () => {
  it('refuses a step that never says where the flow goes next', () => {
    const stranded = questDraftContract.parse(
      draft([
        { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out' },
        { id: 'step_0002', kind: 'complete', objective: 'Done' },
      ]),
    )
    expect(stranded.ok).toBe(false)
    if (stranded.ok) return
    expect(stranded.error).toEqual([{ path: 'steps.0.next', message: 'dead end: no next step and not a complete/fail step' }])

    const wired = questDraftContract.parse(
      draft([
        { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
        { id: 'step_0002', kind: 'complete', objective: 'Done' },
      ]),
    )
    expect(wired.ok).toBe(true)
  })

  it('lets the steps that legitimately end there leave next out', () => {
    const branching = questDraftContract.parse(
      draft([
        { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002', 'step_0005'] },
        {
          id: 'step_0002',
          kind: 'choice',
          prompt: 'Mara wants an answer.',
          objective: 'Give Mara an answer',
          options: [
            { id: 'in', label: 'Take the job', next: 'step_0003' },
            { id: 'out', label: 'Walk away', next: 'step_0004' },
          ],
        },
        { id: 'step_0003', kind: 'complete', objective: 'Done' },
        { id: 'step_0004', kind: 'fail', objective: 'Mara finds someone else' },
        { id: 'step_0005', kind: 'collect', itemId: LEDGER, allowSteal: true, optional: true, objective: 'Pocket the ledger on the way' },
      ]),
    )
    expect(branching.ok).toBe(true)
    if (!branching.ok) return

    // the same quest goes on to pass the full check, so the door refuses nothing playable
    expect(accept(sealQuest(branching.value)).id).toBe('quest_0001')
  })
})
