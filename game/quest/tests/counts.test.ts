import { describe, expect, it } from 'vitest'
import { QuestLog } from '../src/index.ts'
import { CRATES, HOLLIS, MARA, accept, play, quest, refusal, texts } from './fixture.ts'

const [first, second, third, fourth] = CRATES

/** Take three of the five crates and walk them to Hollis. */
function threeOfFive(overrides: Record<string, unknown> = {}): unknown {
  return quest(
    [
      { id: 'step_0001', kind: 'talk', npcId: MARA, objective: 'Hear Mara out', next: ['step_0002'] },
      {
        id: 'step_0002',
        kind: 'collect',
        itemId: first,
        alternates: CRATES.slice(1),
        count: 3,
        allowSteal: true,
        objective: 'Round up three crates',
        next: ['step_0003'],
      },
      {
        id: 'step_0003',
        kind: 'deliver',
        itemId: first,
        alternates: CRATES.slice(1),
        count: 3,
        toNpcId: HOLLIS,
        objective: 'Hand three crates to Hollis',
        next: ['step_0004'],
      },
      { id: 'step_0004', kind: 'complete', objective: 'Done' },
    ],
    overrides,
  )
}

describe('counted steps', () => {
  it('refuses a step that wants more than its pool holds', () => {
    const greedy = quest([
      { id: 'step_0001', kind: 'collect', itemId: first, alternates: [second], count: 3, objective: 'Take three of two', next: ['step_0002'] },
      { id: 'step_0002', kind: 'complete', objective: 'Done' },
    ])
    const { code, messages } = refusal(greedy)
    expect(code).toBe('broken-flow')
    expect(messages.join(' ')).toContain('wants 3 items from a pool of 2')
  })

  it('refuses handing over more than the player was told to pick up', () => {
    const short = quest([
      { id: 'step_0001', kind: 'collect', itemId: first, alternates: CRATES.slice(1), count: 2, objective: 'Take two', next: ['step_0002'] },
      {
        id: 'step_0002',
        kind: 'deliver',
        itemId: first,
        alternates: CRATES.slice(1),
        count: 3,
        toNpcId: HOLLIS,
        objective: 'Hand over three',
        next: ['step_0003'],
      },
      { id: 'step_0003', kind: 'complete', objective: 'Done' },
    ])
    const { code, messages } = refusal(short)
    expect(code).toBe('broken-flow')
    expect(messages.join(' ')).toContain('before the player is guaranteed to have it (sure of 2)')
  })

  it('counts crates one by one and only finishes on the third', () => {
    const { log } = play(threeOfFive())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })

    const progressed = log.handle({ kind: 'acquired', itemId: first })
    expect(progressed.ok).toBe(true)
    if (progressed.ok) {
      expect(progressed.value).toContainEqual({ kind: 'step-progress', questId: 'quest_0001', stepId: 'step_0002', done: 1, needed: 3 })
    }
    expect(log.objectives()[0]?.count).toEqual({ done: 1, needed: 3 })

    // the same crate twice is still one crate
    log.handle({ kind: 'acquired', itemId: first })
    expect(log.objectives()[0]?.count).toEqual({ done: 1, needed: 3 })

    log.handle({ kind: 'acquired', itemId: second })
    log.handle({ kind: 'acquired', itemId: third })
    expect(texts(log)).toEqual(['Hand three crates to Hollis'])

    log.handle({ kind: 'gave', itemId: second, npcId: HOLLIS })
    log.handle({ kind: 'gave', itemId: third, npcId: HOLLIS })
    expect(log.status('quest_0001')).toBe('active')
    log.handle({ kind: 'gave', itemId: fourth, npcId: HOLLIS })
    expect(log.status('quest_0001')).toBe('complete')
  })

  it('resumes a half-counted step without losing what was already handed in', () => {
    const { log, player } = play(threeOfFive())
    log.start('quest_0001')
    log.handle({ kind: 'talked', npcId: MARA })
    log.handle({ kind: 'acquired', itemId: first })
    log.handle({ kind: 'acquired', itemId: second })

    const saved = JSON.parse(JSON.stringify(log.toJSON()))
    const resumed = QuestLog.load(saved, [accept(threeOfFive())], player)
    expect(resumed.ok).toBe(true)
    if (!resumed.ok) return

    expect(resumed.value.objectives()[0]?.count).toEqual({ done: 2, needed: 3 })
    resumed.value.handle({ kind: 'acquired', itemId: first })
    expect(resumed.value.objectives()[0]?.count).toEqual({ done: 2, needed: 3 })
    resumed.value.handle({ kind: 'acquired', itemId: third })
    expect(texts(resumed.value)).toEqual(['Hand three crates to Hollis'])
  })
})
