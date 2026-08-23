import { PlayerState } from '@gb/play'
import { QuestLog, type QuestDoc } from '@gb/quest'
import { describe, expect, it } from 'vitest'
import { ownedItems, Player, verbFor } from './player.ts'
import { buildTown } from './support.ts'
import { Hands, VERBS, type Verb } from './verbs.ts'

/**
 * The harness measuring itself.
 *
 * It exists because the last one emitted three events no running code could
 * produce and reported the quests they finished as playable. Everything below
 * proves the new one cannot do that: it credits a step through a verb the game
 * has or it credits nothing, and it says which verb was missing.
 */

const { world, quests } = await buildTown('harness', { blocksX: 8, blocksY: 8, theme: 'dense neon port city' })
const owned = ownedItems(world)

/** A quest with a step of this kind in it, and one with none. */
const withKind = (kind: string): QuestDoc | undefined => quests.find((quest) => quest.steps.some((step) => step.kind === kind))

function play(quest: QuestDoc, options: { choose?: (opts: ReadonlyArray<{ key: string }>) => number; hands?: Hands } = {}) {
  const state = PlayerState.create(world.id)
  for (const need of quest.requires ?? []) if (need.kind === 'flag') state.setFlag(need.flag, need.value)
  const log = QuestLog.create(quests, state)
  expect(log.start(quest.id).ok, quest.title).toBe(true)
  return { log, state, run: new Player(log, state, { owned, ...options }).play(quest) }
}

/** A player missing one verb, to prove the harness will not credit a step through hands nobody has. */
const without = (verb: Verb) => new Hands([{ verb, owner: '@gb/nobody', why: `nothing reports ${VERBS[verb]}` }])

describe('a quest is credited the way a player credits it', () => {
  it('stops on a step whose verb the player has not got, and names it', () => {
    const quest = withKind('stash')
    expect(quest, 'this town writes nothing that needs putting a thing down').toBeDefined()
    const { run } = play(quest!, { hands: without('put down') })

    expect(run.completable, `${quest!.title} was credited through a verb nobody has`).toBe(false)
    expect(run.blocked.map((block) => block.kind)).toContain('stash')
    expect(run.blocked.map((block) => block.verb)).toContain('put down')
    expect(run.stranded, 'a step waiting on a missing verb is not this box stranding anybody').toEqual([])
  })

  it('finishes the same quest through the put-down the game does have', () => {
    const quest = withKind('stash')!
    const { run } = play(quest)
    expect(run.status, `${quest.title}: ${run.blocked.map((block) => block.why).join('; ')}`).toBe('complete')
    expect(run.paid).toBeGreaterThan(0)
  })

  it('answers a choice with a key the board itself published', () => {
    const quest = withKind('choice')
    expect(quest, 'this town never makes the player pick').toBeDefined()
    const keys = new Set(quest!.steps.flatMap((step) => (step.kind === 'choice' ? step.options.map((option) => option.id) : [])))

    let answered: string | undefined
    const { run } = play(quest!, {
      choose: (options) => {
        answered = options[0]!.key
        return 0
      },
    })
    expect(keys.has(answered!), `answered with ${answered}, which the quest never wrote`).toBe(true)
    expect(run.completable).toBe(true)
  })

  it('leaves a choice exactly where it was when the answer is not one it offered', () => {
    // a stale panel must not be able to finish a decision and strand the quest
    const quest = withKind('choice')!
    const state = PlayerState.create(world.id)
    for (const need of quest.requires ?? []) if (need.kind === 'flag') state.setFlag(need.flag, need.value)
    const log = QuestLog.create(quests, state)
    log.start(quest.id)

    // walk up to the decision by doing everything else the board asks for
    const player = new Player(log, state, { owned })
    const board = () => log.objectives().filter((objective) => objective.questId === quest.id)
    let waiting = board().filter((objective) => objective.choice)
    while (!waiting.length) {
      let moved = false
      for (const objective of board()) moved = player.does(objective, quest.id).moved || moved
      if (!moved) break
      waiting = board().filter((objective) => objective.choice)
    }
    expect(waiting.length, 'the quest never reached its choice').toBeGreaterThan(0)

    const before = board()
    const answered = log.handle({ kind: 'chose', questId: quest.id, stepId: waiting[0]!.stepId, optionId: 'no-such-road' })
    expect(answered.ok && answered.value).toEqual([])
    expect(board()).toEqual(before)
    expect(log.status(quest.id)).toBe('active')
  })

  it('puts an NPC to a subject when the line names one, rather than just talking to them', () => {
    // @gb/talk credits a topic only on the move that asks about it, so a line
    // naming a subject is a different thing to do than a chat
    const line = { stepId: 'step_0001', questId: 'quest_0001', questTitle: 'x', text: 'x', npcId: 'npc_0001' }
    expect(verbFor(line as never)).toBe('talk')
    expect(verbFor({ ...line, topic: 'the missing crate' } as never)).toBe('talk about')
  })

  it('reads what to do off the board and nowhere else', () => {
    // the fields a line publishes are the only thing that says what to do with
    // it, which is what the interface has to go on too
    const state = PlayerState.create(world.id)
    const log = QuestLog.create(quests, state)
    for (const quest of quests) log.start(quest.id)

    const seen = new Set<string>()
    for (const objective of log.objectives()) seen.add(String(verbFor(objective)))
    expect(seen.has('undefined'), 'a line on the board says nothing about what to do with it').toBe(false)
    expect(seen.size, 'the town asks the player for one thing only').toBeGreaterThan(2)
  })
})
