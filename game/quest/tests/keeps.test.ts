import { describe, expect, it } from 'vitest'
import { rewardFor } from '../src/index.ts'
import { BACK_DOOR, LEDGER, MARA, play, quest, refusal } from './fixture.ts'

/** One conversation, paid whatever the test says. */
function favour(reward: object, difficulty: string): unknown {
  return quest(
    [
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
      { id: 'step_0002', kind: 'complete', objective: 'Done' },
    ],
    { reward, difficulty },
  )
}

describe('what a quest hands over', () => {
  it('lands access, a car and a home on the player, and publishes them with the completion', () => {
    const reward = { ...rewardFor('epic'), items: [LEDGER], access: [{ doorId: BACK_DOOR }, { interiorId: 'interior_0001' }], car: 'SUV', deed: 'interior_0001' }
    const { log, player } = play(favour(reward, 'epic'))
    log.start('quest_0001')
    const done = log.handle({ kind: 'talked', npcId: MARA })

    expect(player.has(LEDGER)).toBe(true)
    expect(player.opens({ doorId: BACK_DOOR })).toBe(true)
    expect(player.opens({ interiorId: 'interior_0001' })).toBe(true)
    expect(player.cars()).toEqual(['SUV'])
    expect(player.owns('interior_0001')).toBe(true)
    expect(done.ok && done.value).toContainEqual({ kind: 'quest-complete', questId: 'quest_0001', reward })
  })

  it('refuses access, a car or a home the city does not have', () => {
    const reward = { ...rewardFor('epic'), access: [{ doorId: 'door_0009' }, { interiorId: 'interior_0009' }], deed: 'interior_0009' }
    const refused = refusal(favour(reward, 'epic'))
    expect(refused.code).toBe('broken-flow')
    expect(refused.messages).toEqual([
      'access to door door_0009, which is not in the world',
      'access to interior interior_0009, which is not in the world',
      'deed to interior_0009, which is not in the world',
    ])

    const noSuchCar = refusal(favour({ ...rewardFor('hard'), car: 'Ferrari' }, 'hard'))
    expect(noSuchCar.code).toBe('invalid-quest')
    expect(noSuchCar.messages.some((m) => m.startsWith('reward.car'))).toBe(true)
  })

  it('keeps a car and a home for the jobs that earn them', () => {
    const car = refusal(favour({ ...rewardFor('standard'), car: 'Taxi' }, 'standard'))
    expect(car.code).toBe('unbalanced-reward')
    expect(car.messages).toContain('reward.car: a standard job does not hand over a car')

    const home = refusal(favour({ ...rewardFor('hard'), deed: 'interior_0001' }, 'hard'))
    expect(home.messages).toContain('reward.deed: a hard job does not hand over a home')

    const doors = refusal(favour({ ...rewardFor('small'), access: [{ doorId: BACK_DOOR }, { interiorId: 'interior_0001' }] }, 'small'))
    expect(doors.messages).toContain('reward.access: a small job opens at most 1 door(s) or place(s), this opens 2')
  })
})
