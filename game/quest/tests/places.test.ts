import { describe, expect, it } from 'vitest'
import { MARA, SOLID_LOT, accept, quest, refusal } from './fixture.ts'

/** Hear Mara out, walk to a plot, done. Whichever plot the errand names. */
function errandTo(plotId: string): unknown {
  return quest([
    { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
    { id: 'step_0002', kind: 'goto', place: { plotId }, objective: 'Get over there', next: ['step_0003'] },
    { id: 'step_0003', kind: 'complete', objective: 'Done' },
  ])
}

describe('where a quest can send the player', () => {
  it('refuses a plot that does not open, and takes the one that does', () => {
    const solid = refusal(errandTo(SOLID_LOT))
    expect(solid.code).toBe('broken-flow')
    expect(solid.messages).toContain(`plot ${SOLID_LOT} does not open: there is nothing there the player can walk into`)

    expect(accept(errandTo('plot_0001')).steps[1]!.id).toBe('step_0002')
  })
})
