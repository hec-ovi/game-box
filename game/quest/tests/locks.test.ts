import { describe, expect, it } from 'vitest'
import { BACK_DOOR, HOLLIS, TERMINAL, play, quest, refusal } from './fixture.ts'

/** Hollis gives the word, the back door opens on it, the terminal inside opens, and snake on it is played to 200. */
function breakIn(): unknown {
  return quest([
    {
      id: 'step_0001',
      kind: 'talk',
      npcId: HOLLIS,
      objective: 'Get the word from Hollis',
      next: ['step_0002'],
      effects: [{ kind: 'give-password', password: 'rosebud' }],
    },
    { id: 'step_0002', kind: 'unlock', doorId: BACK_DOOR, objective: 'Get through the back door', next: ['step_0003'] },
    { id: 'step_0003', kind: 'hack', machineId: TERMINAL, objective: 'Open the terminal', next: ['step_0004'] },
    { id: 'step_0004', kind: 'beat-game', machineId: TERMINAL, score: 200, objective: 'Score 200 at snake', next: ['step_0005'] },
    { id: 'step_0005', kind: 'complete', objective: 'Done' },
  ])
}

describe('locks and machines', () => {
  it('tells the player the password, then credits the door, the machine and the score as each happens', () => {
    const { log, player } = play(breakIn())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: HOLLIS })
    expect(player.knows('rosebud')).toBe(true)
    expect(player.passwords()).toEqual([{ password: 'rosebud', from: { questId: 'quest_0001' } }])

    const door = log.objectives()[0]!
    expect(door.doorId).toBe(BACK_DOOR)
    log.handle({ kind: 'unlocked', doorId: 'door_0002' })
    expect(log.status('quest_0001')).toBe('active')
    log.handle({ kind: 'unlocked', doorId: door.doorId! })

    const screen = log.objectives()[0]!
    expect(screen.machineId).toBe(TERMINAL)
    expect(screen.doorId).toBeUndefined()
    log.handle({ kind: 'machine-unlocked', machineId: 'machine_0002' })
    expect(log.objectives()[0]!.stepId).toBe('step_0003')
    log.handle({ kind: 'machine-unlocked', machineId: screen.machineId! })

    const game = log.objectives()[0]!
    expect(game.machineId).toBe(TERMINAL)
    expect(game.score).toBe(200)
    log.handle({ kind: 'scored', machineId: TERMINAL, score: 199 })
    expect(log.status('quest_0001')).toBe('active')
    const beaten = log.handle({ kind: 'scored', machineId: TERMINAL, score: 260 })
    expect(beaten.ok && beaten.value).toContainEqual({ kind: 'step-done', questId: 'quest_0001', stepId: 'step_0004' })
    expect(log.status('quest_0001')).toBe('complete')
  })

  it('refuses a door or a machine the city does not have', () => {
    const noDoor = refusal(
      quest([
        { id: 'step_0001', kind: 'unlock', doorId: 'door_0009', objective: 'Get in', next: ['step_0002'] },
        { id: 'step_0002', kind: 'complete', objective: 'Done' },
      ]),
    )
    expect(noDoor.code).toBe('broken-flow')
    expect(noDoor.messages).toContain('door door_0009 is not in the world')

    const noMachine = refusal(
      quest([
        { id: 'step_0001', kind: 'beat-game', machineId: 'machine_0009', score: 10, objective: 'Play it', next: ['step_0002'] },
        { id: 'step_0002', kind: 'complete', objective: 'Done' },
      ]),
    )
    expect(noMachine.messages).toContain('machine machine_0009 is not in the world')
  })
})
